const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || "./data/armot.db";
const resolvedPath = path.resolve(process.cwd(), DB_PATH);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Esquema
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario',
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Tabla "servicios": reemplaza la hoja de Google Sheets que alimentaba
  -- la pestaña "Resumen Global". Los nombres de columna quedan en snake_case;
  -- el mapeo a las etiquetas originales del Sheet vive en routes/servicios.js.
  CREATE TABLE IF NOT EXISTS servicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dependencia TEXT,
    estado TEXT,
    empresa TEXT,
    unidades REAL DEFAULT 0,
    operarios_min REAL DEFAULT 0,
    operarios_max REAL DEFAULT 0,
    monto_min_sin_iva REAL DEFAULT 0,
    monto_max_sin_iva REAL DEFAULT 0,
    monto_min_con_iva REAL DEFAULT 0,
    monto_max_con_iva REAL DEFAULT 0,
    fecha_inicio TEXT,
    fecha_termino TEXT,
    no_contrato TEXT,
    ejercicio_fiscal TEXT,
    estatus TEXT
  );
`);

// Migración ligera: bases creadas antes de esta versión no tienen la columna "empresa".
const columnas = db.prepare(`PRAGMA table_info(servicios)`).all().map((c) => c.name);
if (!columnas.includes("empresa")) {
  db.exec(`ALTER TABLE servicios ADD COLUMN empresa TEXT`);
}

module.exports = db;
