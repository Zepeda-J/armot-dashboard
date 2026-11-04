const jwt = require("jsonwebtoken");

// Verifica el JWT del encabezado Authorization: Bearer <token> y deja { usuario, rol } en req.usuario.
function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return res.status(401).json({ error: "Sesión no válida." });
  try {
    const p = jwt.verify(m[1], process.env.JWT_SECRET);
    req.usuario = { usuario: p.usuario, rol: p.rol };
    next();
  } catch {
    res.status(401).json({ error: "Sesión expirada." });
  }
}

// Permite solo los roles indicados (requireAuth debe ir antes).
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.usuario?.rol) ? next() : res.status(403).json({ error: "No tienes permiso para esta acción." });

module.exports = { requireAuth, requireRole };
