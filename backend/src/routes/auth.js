const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ error: "Usuario y contraseña son obligatorios." });
  }

  const { rows } = await query("select * from usuarios where usuario = $1", [usuario.trim()]);
  const registro = rows[0];
  if (!registro || !bcrypt.compareSync(password, registro.password_hash)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }

  const token = jwt.sign(
    { usuario: registro.usuario, rol: registro.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );

  res.json({ token, usuario: registro.usuario, rol: registro.rol });
  } catch (e) { next(e); }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ usuario: req.usuario.usuario, rol: req.usuario.rol });
});

module.exports = router;
