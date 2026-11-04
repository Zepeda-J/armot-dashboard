const express = require("express");
const { query } = require("../db/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const INSTRUCCIONES_SISTEMA =
  "Eres un asistente analítico experto de la empresa Armot. Tu objetivo único es responder " +
  "preguntas del usuario basándote estrictamente en el resumen de métricas y la tabla provista. " +
  "Sé ejecutivo, claro, preciso y responde siempre en español. No inventes datos fuera del contexto dado.";

async function construirContexto(pregunta) {
  const resumen = (await query(`SELECT
         COUNT(DISTINCT dependencia) AS dependencias_unicas,
         COALESCE(SUM(unidades), 0) AS total_unidades,
         COALESCE(SUM(operarios_min), 0) AS operarios_min_total,
         COALESCE(SUM(operarios_max), 0) AS operarios_max_total,
         COALESCE(SUM(monto_min_con_iva), 0) AS monto_min_con_iva_total,
         COALESCE(SUM(monto_max_con_iva), 0) AS monto_max_con_iva_total
       FROM servicios`)).rows[0];

  // Igual que en el Streamlit original: si la pregunta trae palabras "de contenido"
  // (más de 3 letras), filtra filas que las contengan; si no, manda una muestra general.
  const palabrasClave = (pregunta.match(/\S+/g) || []).map((p) => p.toLowerCase()).filter((p) => p.length > 3);

  let filas;
  let notaContexto;
  if (palabrasClave.length) {
    const todas = (await query("select * from servicios")).rows;
    filas = todas
      .filter((fila) =>
        palabrasClave.some((p) => Object.values(fila).join(" ").toLowerCase().includes(p))
      )
      .slice(0, 25);
    notaContexto = filas.length
      ? "Nota: Se han extraído las filas del reporte que coinciden dinámicamente con la búsqueda del usuario."
      : "Nota: No hubo coincidencias; se muestra una vista previa general.";
    if (!filas.length) filas = (await query("select * from servicios limit 15")).rows;
  } else {
    filas = (await query("select * from servicios limit 15")).rows;
    notaContexto = "Nota: Mostrando una vista previa general de las primeras filas del reporte debido a falta de palabras clave explícitas.";
  }

  const tablaTexto = filas.length
    ? filas.map((f) => JSON.stringify(f)).join("\n")
    : "(sin filas disponibles)";

  return `--- INSTRUCCIONES DEL SISTEMA ---
${INSTRUCCIONES_SISTEMA}

--- CONTEXTO DE DATOS DE LA EMPRESA ---
- Número de Dependencias Únicas: ${resumen.dependencias_unicas}
- Total de Unidades: ${resumen.total_unidades}
- Elementos Mínimos de Seguridad: ${resumen.operarios_min_total}
- Elementos Máximos de Seguridad: ${resumen.operarios_max_total}
- Monto Mínimo con IVA Global: $${resumen.monto_min_con_iva_total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
- Monto Máximo con IVA Global: $${resumen.monto_max_con_iva_total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
${notaContexto}

--- MUESTRA DE FILAS ---
${tablaTexto}

--- PREGUNTA A RESPONDER ---
Pregunta del usuario: ${pregunta}`;
}

// ---------------------------------------------------------------------------
// Proveedores de IA. Se elige con AI_PROVIDER en backend/.env:
//   groq | openrouter | mistral  → API compatible con OpenAI (AI_API_KEY, AI_MODEL opcional)
//   gemini                       → GEMINI_API_KEY / GEMINI_MODEL
// Si el principal falla y hay GEMINI_API_KEY, se usa Gemini como respaldo.
// ---------------------------------------------------------------------------
const PROVEEDORES_OPENAI = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", modelo: "llama-3.3-70b-versatile" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", modelo: "meta-llama/llama-3.3-70b-instruct:free" },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions", modelo: "mistral-small-latest" },
};

const REINTENTABLES = new Set([408, 429, 500, 502, 503, 504]);
const ESPERAS_MS = [1000, 2500]; // hasta 3 intentos por proveedor
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

class ErrorProveedor extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

async function llamarOpenAI(cfg, apiKey, modelo, prompt) {
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelo, messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new ErrorProveedor(`${r.status}: ${await r.text()}`, r.status);
  const datos = await r.json();
  return datos?.choices?.[0]?.message?.content || "";
}

async function llamarGemini(apiKey, modelo, prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!r.ok) throw new ErrorProveedor(`${r.status}: ${await r.text()}`, r.status);
  const datos = await r.json();
  return datos?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

// Reintenta solo errores temporales (saturación, límites por minuto, red); 400/401/403/404 fallan de inmediato.
async function conReintentos(nombre, fn) {
  let ultimo;
  for (let i = 0; i <= ESPERAS_MS.length; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      const temporal = e.estado ? REINTENTABLES.has(e.estado) : true; // sin estado = fallo de red o timeout
      console.error(`[IA:${nombre}] intento ${i + 1} falló: ${String(e.message).slice(0, 300)}`);
      if (!temporal || i === ESPERAS_MS.length) break;
      await dormir(ESPERAS_MS[i]);
    }
  }
  throw ultimo;
}

function proveedoresConfigurados() {
  const lista = [];
  const principal = (process.env.AI_PROVIDER || (process.env.AI_API_KEY ? "groq" : "gemini")).toLowerCase();
  if (principal !== "gemini") {
    const cfg = PROVEEDORES_OPENAI[principal];
    if (!cfg) {
      console.error(`[IA] AI_PROVIDER="${principal}" no es válido. Usa: groq, openrouter, mistral o gemini.`);
    } else if (process.env.AI_API_KEY) {
      const modelo = process.env.AI_MODEL || cfg.modelo;
      lista.push({ nombre: principal, ejecutar: (p) => llamarOpenAI(cfg, process.env.AI_API_KEY, modelo, p) });
    }
  }
  if (process.env.GEMINI_API_KEY) {
    const modelo = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    lista.push({ nombre: "gemini", ejecutar: (p) => llamarGemini(process.env.GEMINI_API_KEY, modelo, p) });
  }
  return lista;
}

router.post("/chat", requireAuth, requireRole("admin", "usuario"), async (req, res) => {
  const { pregunta } = req.body || {};
  if (!pregunta || !pregunta.trim()) {
    return res.status(400).json({ error: "Falta la pregunta." });
  }

  const proveedores = proveedoresConfigurados();
  if (!proveedores.length) {
    return res.status(200).json({
      desactivado: true,
      respuesta: "El asistente de IA está desactivado. Configura AI_PROVIDER y AI_API_KEY (o GEMINI_API_KEY) en backend/.env.",
    });
  }

  const prompt = await construirContexto(pregunta.trim());
  let saturado = false;

  for (const prov of proveedores) {
    try {
      const texto = await conReintentos(prov.nombre, () => prov.ejecutar(prompt));
      if (!texto) {
        return res.json({ respuesta: "La IA recibió los datos pero no generó texto. Intenta reformular tu pregunta." });
      }
      return res.json({ respuesta: texto });
    } catch (e) {
      if (!e.estado || REINTENTABLES.has(e.estado)) saturado = true;
      console.error(`[IA:${prov.nombre}] sin respuesta, ${proveedores.at(-1) === prov ? "no hay más respaldos." : "probando el respaldo…"}`);
    }
  }

  res.status(saturado ? 503 : 502).json({
    error: saturado
      ? "La IA está saturada en este momento. Intenta de nuevo en unos segundos."
      : "No se pudo obtener respuesta de la IA. Avisa al administrador (revisa la terminal del backend).",
  });
});

module.exports = router;