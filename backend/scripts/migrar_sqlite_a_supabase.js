// Copia usuarios y servicios de data/armot.db (SQLite) a Supabase. Se corre UNA vez, en tu computadora:
//   npm i --no-save better-sqlite3      (solo si no está instalado)
//   node scripts/migrar_sqlite_a_supabase.js [ruta/al/armot.db] [--reset-servicios]
// Conserva los hashes de contraseña, así que cada usuario sigue entrando con la misma contraseña.
// Es idempotente: usuarios existentes no se tocan; servicios solo se cargan si la tabla está vacía.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { query, getPool } = require("../src/db/supabase");

(async () => {
  const origen = path.resolve(process.argv.find((a, i) => i > 1 && !a.startsWith("--")) || process.env.DB_PATH || "./data/armot.db");
  if (!fs.existsSync(origen)) throw new Error(`No existe ${origen}`);
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en .env");

  const lite = new Database(origen, { readonly: true });
  const usuarios = lite.prepare("select id, usuario, password_hash, rol, creado_en from usuarios order by id").all();
  const servicios = lite.prepare("select * from servicios order by id").all();
  console.log(`SQLite: ${usuarios.length} usuarios, ${servicios.length} servicios`);

  await query(fs.readFileSync(path.join(__dirname, "../src/db/schema.sql"), "utf8"));

  let nuevos = 0;
  for (const u of usuarios) {
    const r = await query(
      `insert into usuarios (id, usuario, password_hash, rol, creado_en) values ($1,$2,$3,$4,$5)
       on conflict (usuario) do nothing`,
      [u.id, u.usuario, u.password_hash, u.rol, u.creado_en.replace(" ", "T") + "Z"]
    );
    nuevos += r.rowCount;
  }
  console.log(`usuarios: ${nuevos} insertados, ${usuarios.length - nuevos} ya existían`);

  if (process.argv.includes("--reset-servicios")) await query("delete from servicios");
  const { rows } = await query("select count(*)::int n from servicios");
  if (rows[0].n === 0) {
    const cols = ["id", "dependencia", "estado", "empresa", "unidades", "operarios_min", "operarios_max", "monto_min_sin_iva",
      "monto_max_sin_iva", "monto_min_con_iva", "monto_max_con_iva", "fecha_inicio", "fecha_termino", "no_contrato", "ejercicio_fiscal", "estatus"];
    for (const s of servicios) {
      await query(`insert into servicios (${cols.join(",")}) values (${cols.map((_, i) => "$" + (i + 1)).join(",")})`, cols.map((c) => s[c] ?? null));
    }
    console.log(`servicios: ${servicios.length} insertados`);
  } else {
    console.log(`servicios: la tabla ya tiene ${rows[0].n} filas, no se tocó (usa --reset-servicios para recargar)`);
  }

  // Los ids se copiaron a mano: alinea las secuencias para que los próximos inserts no choquen.
  for (const t of ["usuarios", "servicios"]) {
    await query(`select setval(pg_get_serial_sequence('${t}','id'), greatest((select coalesce(max(id),0) from ${t}),1))`);
  }

  const a = (await query("select count(*)::int n from usuarios")).rows[0].n;
  const b = (await query("select count(*)::int n from servicios")).rows[0].n;
  console.log(`Supabase ahora: ${a} usuarios, ${b} servicios`);
  await getPool().end();
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });
