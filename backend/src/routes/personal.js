// Coordinadores y Administración. Cada credencial es un documento JSONB en `personal`
// (la foto va aparte en `foto`/`foto_hash`) y las bajas/reactivaciones quedan en `historial_laboral`.
const express = require("express");
const crypto = require("crypto");
const { query, requireDb } = require("../db/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const TIPOS = {
  coordinadores: { tipo: "Coordinadores", prefijo: "USR" },
  administracion: { tipo: "Administración", prefijo: "ADM" },
};
const ESTADOS = ["Activo", "Pendiente", "Inactivo"];
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

function tipoDe(req, res, next) {
  const t = TIPOS[req.params.ruta];
  if (!t) return res.status(404).json({ error: "Sección no encontrada." });
  req.cfg = t;
  next();
}

const leer = [requireAuth, requireRole("admin", "usuario", "personal"), requireDb, tipoDe];
const escribir = [requireAuth, requireRole("admin", "usuario"), requireDb, tipoDe];

function parseDoc(d) {
  return typeof d === "string" ? JSON.parse(d) : d || {};
}

function limpiarTexto(v) {
  return String(v ?? "").trim();
}

// "15-Marzo-2019" o "15/03/2019" -> Date; cualquier otro texto ("Reciente") -> null
function parseFechaIngreso(texto) {
  const m = String(texto || "").match(/^\s*(\d{1,2})[-/\s]+([A-Za-zÁÉÍÓÚáéíóúÑñ]+|\d{1,2})[-/\s]+(\d{4})\s*$/);
  if (!m) return null;
  const mes = /^\d+$/.test(m[2]) ? Number(m[2]) : MESES[m[2].toLowerCase().replace("á", "a").replace("é", "e")];
  if (!mes) return null;
  const d = new Date(Date.UTC(Number(m[3]), mes - 1, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function antiguedad(ingreso, hasta) {
  if (!ingreso || hasta < ingreso) return { texto: "—", dias: null };
  const dias = Math.floor((hasta - ingreso) / 86400000);
  const anios = Math.floor(dias / 365);
  const meses = Math.floor((dias % 365) / 30);
  if (anios) return { texto: `${anios} año(s) ${meses} mes(es)`, dias };
  return { texto: meses ? `${meses} mes(es)` : "menos de 1 mes", dias };
}

function fechaHoraMx(d) {
  const p = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

async function registrarHistorial(tipo, anterior, estadoNuevo, motivo, usuario) {
  const estadoAnterior = anterior.estado || "";
  if (estadoAnterior === estadoNuevo || ![estadoAnterior, estadoNuevo].includes("Inactivo")) return;
  const ahora = new Date();
  const ant = antiguedad(parseFechaIngreso(anterior.fecha_ingreso), ahora);
  const entrada = {
    fecha: fechaHoraMx(ahora),
    tipo,
    id: anterior.id || "",
    nombre: anterior.nombre || "",
    puesto: anterior.puesto || "",
    departamento: anterior.departamento || "",
    evento: estadoNuevo === "Inactivo" ? "Baja" : "Reactivación",
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    fecha_ingreso: anterior.fecha_ingreso || "—",
    antiguedad: ant.texto,
    antiguedad_dias: ant.dias,
    motivo: limpiarTexto(motivo),
    registrado_por: usuario || "—",
  };
  await query("insert into historial_laboral (datos) values ($1::jsonb)", [JSON.stringify(entrada)]);
}

function leerFoto(base64) {
  if (!base64) return null;
  const limpio = String(base64).replace(/^data:image\/\w+;base64,/, "");
  const buf = Buffer.from(limpio, "base64");
  if (!buf.length) return null;
  if (buf.length > 3 * 1024 * 1024) throw Object.assign(new Error("La foto pesa más de 3 MB."), { status: 400 });
  const esPng = buf.slice(0, 4).toString("hex") === "89504e47";
  const esJpg = buf.slice(0, 2).toString("hex") === "ffd8";
  if (!esPng && !esJpg) throw Object.assign(new Error("La foto debe ser JPG o PNG."), { status: 400 });
  return buf;
}

async function guardarFoto(tipo, id, buf) {
  const hash = crypto.createHash("md5").update(buf).digest("hex");
  await query("update personal set foto = $1, foto_hash = $2 where tipo = $3 and id = $4", [buf, hash, tipo, id]);
}

function publico(fila) {
  const d = parseDoc(fila.datos);
  return { ...d, id: String(fila.id), tieneFoto: Boolean(fila.foto_hash), fotoHash: fila.foto_hash || "" };
}

// GET /api/personal/:ruta
router.get("/:ruta", ...leer, async (req, res, next) => {
  try {
    const r = await query("select id, datos, foto_hash from personal where tipo = $1 order by orden", [req.cfg.tipo]);
    res.json({ personas: r.rows.map(publico) });
  } catch (e) { next(e); }
});

// GET /api/personal/:ruta/historial
router.get("/:ruta/historial", ...leer, async (req, res, next) => {
  try {
    const r = await query("select datos from historial_laboral order by id", []);
    const historial = r.rows.map((f) => parseDoc(f.datos)).filter((h) => h.tipo === req.cfg.tipo);
    res.json({ historial });
  } catch (e) { next(e); }
});

// GET /api/personal/:ruta/:id/foto
router.get("/:ruta/:id/foto", ...leer, async (req, res, next) => {
  try {
    const r = await query("select foto, foto_hash from personal where tipo = $1 and id = $2", [req.cfg.tipo, req.params.id]);
    const f = r.rows[0];
    if (!f || !f.foto) return res.status(404).end();
    const png = f.foto.slice(0, 4).toString("hex") === "89504e47";
    res.set({ "Content-Type": png ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=300", ETag: f.foto_hash || "" });
    res.send(f.foto);
  } catch (e) { next(e); }
});

// POST /api/personal/:ruta  — alta
router.post("/:ruta", ...escribir, async (req, res, next) => {
  try {
    const b = req.body || {};
    const nombre = limpiarTexto(b.nombre);
    const puesto = limpiarTexto(b.puesto);
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio." });
    if (req.params.ruta === "administracion" && !puesto) return res.status(400).json({ error: "El puesto es obligatorio." });
    const estado = ESTADOS.includes(b.estado) ? b.estado : "Activo";
    const foto = leerFoto(b.fotoBase64);

    const existentes = await query("select id from personal where tipo = $1", [req.cfg.tipo]);
    const ids = existentes.rows.map((x) => String(x.id));
    let id = limpiarTexto(b.id);
    if (id) {
      if (ids.includes(id)) return res.status(400).json({ error: `El ID '${id}' ya existe. Usa un identificador distinto.` });
    } else {
      const nums = ids.map((x) => (x.match(/(\d+)$/) || [])[1]).filter(Boolean).map(Number);
      id = `${req.cfg.prefijo}-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
    }

    const doc = {
      id, nombre, puesto,
      departamento: limpiarTexto(b.departamento),
      estado,
      foto: null,
      email: limpiarTexto(b.email) || `${nombre.toLowerCase().replace(/\s+/g, ".")}@empresa.com`,
      telefono: limpiarTexto(b.telefono) || "+52 (55) 0000-0000",
      fecha_ingreso: limpiarTexto(b.fecha_ingreso) || "Reciente",
      ubicacion: "Por asignar",
      nivel_acceso: limpiarTexto(b.nivel_acceso),
      proyectos: [],
      habilidades: ["Colaboración"],
      ...(req.params.ruta === "coordinadores" ? { servicios: [] } : {}),
    };
    await query("insert into personal (tipo, id, datos) values ($1, $2, $3::jsonb)", [req.cfg.tipo, id, JSON.stringify(doc)]);
    if (foto) await guardarFoto(req.cfg.tipo, id, foto);
    res.status(201).json({ ok: true, id });
  } catch (e) { next(e); }
});

// PUT /api/personal/:ruta/:id  — edición (conserva los demás campos del documento: servicios, proyectos, habilidades…)
router.put("/:ruta/:id", ...escribir, async (req, res, next) => {
  try {
    const b = req.body || {};
    const r = await query("select datos from personal where tipo = $1 and id = $2", [req.cfg.tipo, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "La credencial ya no existe." });
    const actual = parseDoc(r.rows[0].datos);

    const nombre = limpiarTexto(b.nombre);
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio." });
    const estado = ESTADOS.includes(b.estado) ? b.estado : actual.estado;
    const foto = leerFoto(b.fotoBase64);

    await registrarHistorial(req.cfg.tipo, actual, estado, b.motivo, req.usuario.usuario);

    const nuevo = {
      ...actual,
      nombre,
      puesto: limpiarTexto(b.puesto),
      departamento: limpiarTexto(b.departamento),
      estado,
      email: limpiarTexto(b.email),
      telefono: limpiarTexto(b.telefono),
      nivel_acceso: limpiarTexto(b.nivel_acceso),
    };
    if (foto) nuevo.foto = null;
    await query("update personal set datos = $1::jsonb, actualizado_en = now() where tipo = $2 and id = $3", [
      JSON.stringify(nuevo), req.cfg.tipo, req.params.id,
    ]);
    if (foto) await guardarFoto(req.cfg.tipo, req.params.id, foto);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/personal/:ruta/:id
router.delete("/:ruta/:id", ...escribir, async (req, res, next) => {
  try {
    const r = await query("delete from personal where tipo = $1 and id = $2", [req.cfg.tipo, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: "La credencial ya no existe." });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Los errores con .status (validaciones) llegan al cliente con su mensaje.
router.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  next(err);
});

module.exports = router;
