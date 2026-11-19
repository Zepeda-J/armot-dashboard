// Contexto de las demás pestañas para el asistente de IA (y por tanto para Jarvis):
// Coordinadores, Administración (+ histórico laboral), Seguimiento de facturación y Acuerdos.
// Igual que con "servicios": los totales se calculan aquí con datos reales y la IA solo los lee.
//
// Privacidad: correo y teléfono del personal NO se envían al proveedor de IA salvo que pongas
// AI_INCLUIR_CONTACTO=true en backend/.env. Las fotos y los hashes de contraseña nunca se envían.
const { query, configurado } = require("../db/supabase");

const DIAS_POR_VENCER = 90;
const MAX_FILAS = 25;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const dinero = (n) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const doc = (d) => (typeof d === "string" ? JSON.parse(d) : d || {});
const hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date()); // aaaa-mm-dd
const sumarDias = (iso, dias) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const contar = (filas, clave) => {
  const m = new Map();
  for (const f of filas) {
    const k = String(f[clave] ?? "").trim() || "(sin dato)";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(" | ") || "(sin datos)";
};

function palabrasClave(pregunta) {
  return (pregunta.match(/\S+/g) || []).map((p) => p.toLowerCase().replace(/[¿?¡!.,;:]/g, "")).filter((p) => p.length > 3);
}

// Filas que mencionan alguna palabra de la pregunta (máx. MAX_FILAS); si no hay coincidencias, las primeras 10.
function muestra(filas, texto, claves) {
  const hit = claves.length ? filas.filter((f) => claves.some((p) => texto(f).includes(p))).slice(0, MAX_FILAS) : [];
  return hit.length ? hit : filas.slice(0, 10);
}

async function seccionPersonal(pregunta, claves) {
  const incluirContacto = String(process.env.AI_INCLUIR_CONTACTO || "").toLowerCase() === "true";
  const r = await query("select tipo, id, datos from personal order by tipo, orden", []);
  const personas = r.rows.map((f) => ({ ...doc(f.datos), id: String(f.id), _tipo: f.tipo }));
  const h = (await query("select datos from historial_laboral order by id", [])).rows.map((f) => doc(f.datos));

  const compacta = (p) => {
    const base = {
      id: p.id, nombre: p.nombre, puesto: p.puesto, departamento: p.departamento, estado: p.estado,
      fecha_ingreso: p.fecha_ingreso, ubicacion: p.ubicacion, nivel_acceso: p.nivel_acceso,
      proyectos: p.proyectos, habilidades: p.habilidades,
    };
    if (Array.isArray(p.servicios) && p.servicios.length) base.servicios = JSON.stringify(p.servicios).slice(0, 350);
    if (incluirContacto) { base.email = p.email; base.telefono = p.telefono; }
    return JSON.stringify(base);
  };

  const bloques = [];
  for (const [tipo, titulo] of [["Coordinadores", "COORDINADORES"], ["Administración", "ADMINISTRACIÓN"]]) {
    const lista = personas.filter((p) => p._tipo === tipo);
    const conServ = lista.reduce((a, p) => a + (Array.isArray(p.servicios) ? p.servicios.reduce((s, x) => s + (parseInt(x?.["Cantidad real"], 10) || 0), 0) : 0), 0);
    const elegidas = muestra(lista, (p) => compacta(p).toLowerCase(), claves);
    bloques.push(
      `${titulo} — total: ${lista.length}\n` +
      `Por estado: ${contar(lista, "estado")}\nPor departamento: ${contar(lista, "departamento")}\nPor puesto: ${contar(lista, "puesto")}\n` +
      (tipo === "Coordinadores" ? `Servicios asignados (cantidad real, suma): ${conServ}\n` : "") +
      `Fichas (${elegidas.length} de ${lista.length}, las más relacionadas con la pregunta):\n${elegidas.map(compacta).join("\n") || "(sin personas)"}`
    );
  }

  const hist = muestra(h, (x) => JSON.stringify(x).toLowerCase(), claves).map((x) =>
    JSON.stringify({ fecha: x.fecha, tipo: x.tipo, id: x.id, nombre: x.nombre, evento: x.evento, antiguedad: x.antiguedad, motivo: x.motivo })
  );
  bloques.push(`HISTÓRICO LABORAL (bajas y reactivaciones) — total: ${h.length}\nPor evento: ${contar(h, "evento")}\nRegistros relacionados:\n${hist.join("\n") || "(sin registros)"}`);
  return bloques.join("\n\n");
}

async function seccionFacturacion(claves) {
  const filas = (await query("select id, datos from tablero_filas where tablero = 'facturacion' order by id", [])).rows.map((f) => ({ id: Number(f.id), ...doc(f.datos) }));
  const hoy = hoyISO();
  const vencida = (f) => f["Estatus"] === "Facturada" && f["Vencimiento"] && String(f["Vencimiento"]).slice(0, 10) < hoy;
  const porEstatus = {};
  for (const f of filas) {
    const k = f["Estatus"] || "(sin estatus)";
    porEstatus[k] = porEstatus[k] || { n: 0, monto: 0 };
    porEstatus[k].n++;
    porEstatus[k].monto += num(f["Monto c/IVA"]);
  }
  const venc = filas.filter(vencida);
  const elegidas = muestra(filas, (f) => JSON.stringify(f).toLowerCase(), claves);
  return (
    `SEGUIMIENTO DE FACTURACIÓN — facturas: ${filas.length} (fecha de hoy: ${hoy})\n` +
    `Por estatus (cantidad y monto c/IVA): ${Object.entries(porEstatus).map(([k, v]) => `${k}: ${v.n} (${dinero(v.monto)})`).join(" | ") || "(sin datos)"}\n` +
    `Monto total c/IVA: ${dinero(filas.reduce((a, f) => a + num(f["Monto c/IVA"]), 0))}\n` +
    `Facturas VENCIDAS (facturadas y con vencimiento anterior a hoy): ${venc.length}, por ${dinero(venc.reduce((a, f) => a + num(f["Monto c/IVA"]), 0))}\n` +
    (venc.length ? `Detalle de vencidas:\n${venc.slice(0, MAX_FILAS).map((f) => JSON.stringify(f)).join("\n")}\n` : "") +
    `Facturas relacionadas con la pregunta:\n${elegidas.map((f) => JSON.stringify(f)).join("\n") || "(sin facturas)"}`
  );
}

async function seccionAcuerdos(claves) {
  const filas = (await query("select id, datos from tablero_filas where tablero = 'acuerdos' order by id", [])).rows.map((f) => ({ id: Number(f.id), ...doc(f.datos) }));
  const hoy = hoyISO();
  const limite = sumarDias(hoy, DIAS_POR_VENCER);
  const porVencer = filas.filter((f) => f["Estatus"] === "Vigente" && f["Vigencia hasta"] && String(f["Vigencia hasta"]).slice(0, 10) <= limite);
  const elegidas = muestra(filas, (f) => JSON.stringify(f).toLowerCase(), claves);
  return (
    `ACUERDOS Y CONVENIOS — total: ${filas.length} (fecha de hoy: ${hoy})\n` +
    `Por estatus: ${contar(filas, "Estatus")}\nPor tipo: ${contar(filas, "Tipo")}\nPor relación: ${contar(filas, "Relación")}\n` +
    `Monto total: ${dinero(filas.reduce((a, f) => a + num(f["Monto"]), 0))}\n` +
    `Vigentes que vencen en los próximos ${DIAS_POR_VENCER} días (o ya pasaron su fecha): ${porVencer.length}\n` +
    (porVencer.length ? `${porVencer.slice(0, MAX_FILAS).map((f) => JSON.stringify(f)).join("\n")}\n` : "") +
    `Acuerdos relacionados con la pregunta:\n${elegidas.map((f) => JSON.stringify(f)).join("\n") || "(sin acuerdos)"}`
  );
}

// Devuelve el texto con todas las secciones; si una falla (tabla vacía o sin crear) se avisa y las demás siguen.
async function contextoSecciones(pregunta) {
  if (!configurado()) return "(Las demás pestañas no están disponibles: falta configurar Supabase.)";
  const claves = palabrasClave(pregunta);
  const partes = [];
  for (const [nombre, fn] of [
    ["Coordinadores y Administración", () => seccionPersonal(pregunta, claves)],
    ["Seguimiento de facturación", () => seccionFacturacion(claves)],
    ["Acuerdos", () => seccionAcuerdos(claves)],
  ]) {
    try {
      partes.push(await fn());
    } catch (e) {
      console.error(`[IA] no se pudo leer "${nombre}":`, String(e.message).slice(0, 200));
      partes.push(`(${nombre}: no disponible por un error al leer los datos.)`);
    }
  }
  return partes.join("\n\n");
}

module.exports = { contextoSecciones };
