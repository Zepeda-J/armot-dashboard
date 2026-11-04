const express = require("express");
const { query, requireDb } = require("../db/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/servicios — todas las filas del reporte.
// Los filtros, KPIs y gráficas se calculan en el frontend para que respondan
// en tiempo real al mover cualquier control (igual que el tablero de Streamlit).
router.get("/", requireAuth, requireRole("admin", "usuario"), requireDb, async (req, res, next) => {
  try {
    const { rows: filas } = await query("select * from servicios order by dependencia, no_contrato");
    res.json({ filas, actualizado: new Date().toISOString() });
  } catch (e) { next(e); }
});

module.exports = router;
