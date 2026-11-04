// Tableros editables (Seguimiento de facturación y Acuerdos y convenios).
// Cada fila vive en `tablero_filas` (tablero, datos JSONB, creado_por, actualizado_en), igual que en el Streamlit.
const express = require("express");
const { query, requireDb } = require("../db/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const ESTATUS_FACTURA = ["Por facturar", "Facturada", "Pagada", "Cancelada"];
const ESTATUS_ACUERDO = ["Borrador", "En revisión", "Vigente", "Vencido", "Cancelado"];

// t: texto | numero | fecha | opcion | link
const TABLEROS = {
  facturacion: {
    campos: [
      { n: "Folio", t: "texto", req: true },
      { n: "Contrato", t: "texto" },
      { n: "Dependencia", t: "texto" },
      { n: "Concepto", t: "texto" },
      { n: "Monto c/IVA", t: "numero" },
      { n: "Emisión", t: "fecha" },
      { n: "Vencimiento", t: "fecha" },
      { n: "Fecha de pago", t: "fecha" },
      { n: "Estatus", t: "opcion", op: ESTATUS_FACTURA },
    ],
  },
  acuerdos: {
    campos: [
      { n: "Folio", t: "texto", req: true },
      { n: "Tipo", t: "opcion", op: ["Convenio", "Acuerdo", "Convenio modificatorio", "Addendum"] },
      { n: "Contraparte", t: "texto", req: true },
      { n: "Relación", t: "opcion", op: ["Cliente", "Proveedor"] },
      { n: "Objeto", t: "texto" },
      { n: "Fecha de firma", t: "fecha" },
      { n: "Vigencia hasta", t: "fecha" },
      { n: "Monto", t: "numero" },
      { n: "Responsable", t: "texto" },
      { n: "Enlace", t: "link" },
      { n: "Estatus", t: "opcion", op: ESTATUS_ACUERDO },
    ],
  },
};

function fechaISO(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // dd/mm/aaaa
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Mismo formato que _valor_json del Streamlit: texto "" si está vacío, número/fecha null si está vacío.
function normalizar(campos, entrada) {
  const salida = {};
  for (const c of campos) {
    const v = entrada?.[c.n];
    if (c.t === "numero") {
      const n = v === "" || v === null || v === undefined ? NaN : Number(String(v).replace(/[$,\s]/g, ""));
      salida[c.n] = Number.isFinite(n) ? n : null;
    } else if (c.t === "fecha") {
      salida[c.n] = fechaISO(v);
    } else {
      salida[c.n] = v === null || v === undefined ? "" : String(v).trim();
    }
  }
  return salida;
}

function tablero(req, res, next) {
  const cfg = TABLEROS[req.params.clave];
  if (!cfg) return res.status(404).json({ error: "Tablero no encontrado." });
  req.cfg = cfg;
  next();
}

const permisos = [requireAuth, requireRole("admin", "usuario"), requireDb, tablero];

// GET /api/tableros/:clave
router.get("/:clave", ...permisos, async (req, res, next) => {
  try {
    const r = await query(
      "select id, datos, creado_por, actualizado_en from tablero_filas where tablero = $1 order by id",
      [req.params.clave]
    );
    const filas = r.rows.map((f) => ({
      id: Number(f.id),
      datos: normalizar(req.cfg.campos, typeof f.datos === "string" ? JSON.parse(f.datos) : f.datos),
      creadoPor: f.creado_por,
      actualizadoEn: f.actualizado_en,
    }));
    res.json({ campos: req.cfg.campos, filas });
  } catch (e) { next(e); }
});

// POST /api/tableros/:clave  { filas: [ {...}, ... ], importar?: true }
router.post("/:clave", ...permisos, async (req, res, next) => {
  try {
    const entrada = Array.isArray(req.body?.filas) ? req.body.filas : [];
    if (!entrada.length) return res.status(400).json({ error: "No hay filas para agregar." });
    if (entrada.length > 2000) return res.status(400).json({ error: "Máximo 2000 filas por importación." });

    const filas = entrada.map((f) => normalizar(req.cfg.campos, f));
    if (!req.body.importar) {
      for (const f of filas) {
        const falta = req.cfg.campos.find((c) => c.req && !f[c.n]);
        if (falta) return res.status(400).json({ error: `El campo "${falta.n}" es obligatorio.` });
      }
    }
    for (const f of filas) {
      await query(
        "insert into tablero_filas (tablero, datos, creado_por) values ($1, $2::jsonb, $3)",
        [req.params.clave, JSON.stringify(f), req.usuario.usuario || null]
      );
    }
    res.status(201).json({ ok: true, agregadas: filas.length });
  } catch (e) { next(e); }
});

// PUT /api/tableros/:clave/:id  { datos: {...} }
router.put("/:clave/:id(\\d+)", ...permisos, async (req, res, next) => {
  try {
    const datos = normalizar(req.cfg.campos, req.body?.datos);
    const falta = req.cfg.campos.find((c) => c.req && !datos[c.n]);
    if (falta) return res.status(400).json({ error: `El campo "${falta.n}" es obligatorio.` });
    const r = await query(
      "update tablero_filas set datos = $1::jsonb, actualizado_en = now() where id = $2 and tablero = $3",
      [JSON.stringify(datos), req.params.id, req.params.clave]
    );
    if (!r.rowCount) return res.status(404).json({ error: "El registro ya no existe." });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/tableros/:clave/eliminar  { ids: [1, 2] }
router.post("/:clave/eliminar", ...permisos, async (req, res, next) => {
  try {
    const ids = (req.body?.ids || []).map(Number).filter(Number.isInteger);
    if (!ids.length) return res.status(400).json({ error: "No se indicaron registros." });
    const r = await query("delete from tablero_filas where tablero = $1 and id = any($2::bigint[])", [
      req.params.clave,
      ids,
    ]);
    res.json({ ok: true, eliminadas: r.rowCount });
  } catch (e) { next(e); }
});

module.exports = router;
