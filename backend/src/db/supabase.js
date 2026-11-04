// Conexión a Supabase (PostgreSQL) — las mismas tablas que usaba el Streamlit:
//   tablero_filas (facturación y acuerdos), personal, historial_laboral, app_config.
const { Pool } = require("pg");

let pool = null;

function configurado() {
  return Boolean(process.env.DATABASE_URL);
}

function urlLimpia() {
  // El secrets.toml de Streamlit usa "postgresql+psycopg2://..."; el driver de Node quiere "postgresql://...".
  // Se quita sslmode de la URL porque el SSL se configura abajo explícitamente.
  return process.env.DATABASE_URL.trim()
    .replace(/^postgres(ql)?\+\w+:\/\//, "postgresql://")
    .replace(/([?&])sslmode=[^&]*&?/, "$1")
    .replace(/[?&]$/, "");
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: urlLimpia(),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
    pool.on("error", (e) => console.error("[supabase] error en el pool:", e.message));
  }
  return pool;
}

// Si el pooler cerró la conexión por inactividad, reinicia el pool y reintenta una vez (igual que _con_reintento).
async function query(texto, params) {
  try {
    return await getPool().query(texto, params);
  } catch (e) {
    if (/terminat|ECONNRESET|ETIMEDOUT|Connection|timeout/i.test(e.message)) {
      const viejo = pool;
      pool = null;
      if (viejo) await viejo.end().catch(() => {});
      return getPool().query(texto, params);
    }
    throw e;
  }
}

function requireDb(req, res, next) {
  if (!configurado()) {
    return res.status(503).json({
      error: "Supabase no está configurado. Agrega DATABASE_URL en backend/.env y reinicia el backend.",
    });
  }
  next();
}

module.exports = { query, getPool, requireDb, configurado };
