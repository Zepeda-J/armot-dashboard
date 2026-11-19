const express = require("express");
const { query } = require("../db/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const { valoresDisponibles, resumenPorDimension, interpretarSalida } = require("../ai/graficas");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const router = express.Router();

const INSTRUCCIONES_SISTEMA =
  "Eres un asistente analítico experto de la empresa Armot. Tu objetivo único es responder " +
  "preguntas del usuario basándote estrictamente en el resumen de métricas y las tablas provistas. " +
  "Sé ejecutivo, claro, preciso y responde siempre en español. No inventes datos fuera del contexto dado.";

const FORMATO_SALIDA = `Responde SOLO con un objeto JSON válido (sin texto fuera del JSON y sin bloques de código) con esta forma:
{"respuesta": "texto en español con formato Markdown (listas con guiones, **negritas**, tablas si ayudan)", "graficas": []}

Reglas para "graficas":
- Es una lista (puede ir vacía). Máximo 3 gráficas.
- Inclúyelas cuando el usuario pida una gráfica, gráfico, estadística, comparativo, distribución, ranking o tendencia, o cuando una visual ayude claramente. Si es una pregunta puntual, déjala vacía [].
- NO escribas los valores de la gráfica: el sistema los calcula con datos reales a partir de tu especificación. Cada gráfica es:
  {"tipo": "barras" | "barras_horizontales" | "linea" | "pastel",
   "titulo": "título corto",
   "dimension": "dependencia" | "estado" | "empresa" | "estatus" | "ejercicio_fiscal",
   "metrica": "monto_max_con_iva" | "monto_min_con_iva" | "monto_max_sin_iva" | "monto_min_sin_iva" | "unidades" | "operarios_min" | "operarios_max" | "contratos",
   "agregacion": "suma" | "promedio" | "maximo",
   "filtros": {"estado": ["México"]},   // opcional; solo dimensiones de la lista y valores EXACTOS de VALORES DISPONIBLES
   "top": 10,                            // opcional, 1 a 20
   "orden": "desc" | "asc"}              // opcional
- Usa "pastel" solo para proporciones de un total con pocas categorías; "linea" solo con dimension "ejercicio_fiscal"; "barras_horizontales" cuando los nombres son largos.
- En "respuesta" comenta lo que muestran las gráficas usando las cifras de las TABLAS POR DIMENSIÓN, sin repetir toda la tabla.`;

async function construirContexto(pregunta, historial, filas) {
  const sumar = (k) => filas.reduce((a, f) => a + num(f[k]), 0);
  const unicos = (k) => new Set(filas.map((f) => String(f[k] ?? "").trim()).filter(Boolean)).size;
  const dinero = (n) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  const disponibles = valoresDisponibles(filas);

  // Igual que en el Streamlit original: palabras "de contenido" (más de 3 letras) filtran filas de muestra.
  const palabrasClave = (pregunta.match(/\S+/g) || []).map((p) => p.toLowerCase()).filter((p) => p.length > 3);
  let muestra = palabrasClave.length
    ? filas.filter((f) => palabrasClave.some((p) => Object.values(f).join(" ").toLowerCase().includes(p))).slice(0, 20)
    : [];
  if (!muestra.length) muestra = filas.slice(0, 15);

  const conversacion = historial.length
    ? `\n--- CONVERSACIÓN PREVIA (para entender preguntas de seguimiento) ---\n${historial.map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`).join("\n")}\n`
    : "";

  return `--- INSTRUCCIONES DEL SISTEMA ---
${INSTRUCCIONES_SISTEMA}

--- FORMATO DE SALIDA (OBLIGATORIO) ---
${FORMATO_SALIDA}

--- CONTEXTO DE DATOS DE LA EMPRESA ---
- Número de Dependencias Únicas: ${unicos("dependencia")}
- Contratos únicos: ${unicos("no_contrato")}
- Total de Unidades: ${sumar("unidades")}
- Elementos Mínimos de Seguridad: ${sumar("operarios_min")}
- Elementos Máximos de Seguridad: ${sumar("operarios_max")}
- Monto Mínimo con IVA Global: ${dinero(sumar("monto_min_con_iva"))}
- Monto Máximo con IVA Global: ${dinero(sumar("monto_max_con_iva"))}

--- VALORES DISPONIBLES (para filtros) ---
${Object.entries(disponibles).map(([d, v]) => `${d}: ${v.join(" | ") || "(sin datos)"}`).join("\n")}

--- TABLAS POR DIMENSIÓN (totales ya calculados) ---
POR DEPENDENCIA:
${resumenPorDimension(filas, "dependencia")}
POR ESTADO:
${resumenPorDimension(filas, "estado")}
POR EMPRESA:
${resumenPorDimension(filas, "empresa")}
POR ESTATUS:
${resumenPorDimension(filas, "estatus")}

--- MUESTRA DE FILAS ---
${muestra.map((f) => JSON.stringify(f)).join("\n") || "(sin filas disponibles)"}
${conversacion}
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
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", modelo: "llama-3.3-70b-versatile", json: true },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", modelo: "meta-llama/llama-3.3-70b-instruct:free" },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions", modelo: "mistral-small-latest", json: true },
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
  const pedir = async (conJson) => {
    const r = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        ...(conJson ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) throw new ErrorProveedor(`${r.status}: ${await r.text()}`, r.status);
    const datos = await r.json();
    return datos?.choices?.[0]?.message?.content || "";
  };
  if (!cfg.json) return pedir(false);
  try {
    return await pedir(true);
  } catch (e) {
    if (e.estado === 400) return pedir(false); // el modelo no soportó el modo JSON: se intenta sin él
    throw e;
  }
}

async function llamarGemini(apiKey, modelo, prompt) {
  const pedir = async (conJson) => {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          ...(conJson ? { generationConfig: { responseMimeType: "application/json" } } : {}),
        }),
        signal: AbortSignal.timeout(45000),
      }
    );
    if (!r.ok) throw new ErrorProveedor(`${r.status}: ${await r.text()}`, r.status);
    const datos = await r.json();
    return datos?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  };
  try {
    return await pedir(true);
  } catch (e) {
    if (e.estado === 400) return pedir(false);
    throw e;
  }
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
  if (!pregunta || typeof pregunta !== "string" || !pregunta.trim()) {
    return res.status(400).json({ error: "Falta la pregunta." });
  }
  if (pregunta.length > 1000) return res.status(400).json({ error: "La pregunta es demasiado larga (máx. 1,000 caracteres)." });

  // Mensajes previos de la conversación (para preguntas de seguimiento como "¿y por estado?").
  const historial = (Array.isArray(req.body.historial) ? req.body.historial : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1200) }));

  const proveedores = proveedoresConfigurados();
  if (!proveedores.length) {
    return res.status(200).json({
      desactivado: true,
      respuesta: "El asistente de IA está desactivado. Configura AI_PROVIDER y AI_API_KEY (o GEMINI_API_KEY) en backend/.env.",
      graficas: [],
    });
  }

  const filas = (await query("select * from servicios order by id")).rows;
  const prompt = await construirContexto(pregunta.trim(), historial, filas);
  let saturado = false;

  for (const prov of proveedores) {
    try {
      const texto = await conReintentos(prov.nombre, () => prov.ejecutar(prompt));
      if (!texto) {
        return res.json({ respuesta: "La IA recibió los datos pero no generó texto. Intenta reformular tu pregunta.", graficas: [] });
      }
      return res.json(interpretarSalida(texto, filas));
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