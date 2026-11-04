require("dotenv").config();
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { query, getPool } = require("./supabase");

// ---------------------------------------------------------------------------
// Usuarios migrados desde el diccionario USUARIOS del Streamlit original.
// Por seguridad NO se copian las contraseñas originales: se genera una
// contraseña temporal por usuario y se imprime una sola vez en consola.
// Cámbialas después de este primer arranque.
// ---------------------------------------------------------------------------
const USUARIOS = [
  { usuario: "admin", rol: "admin" },
  { usuario: "Fernando", rol: "usuario" },
  { usuario: "Alfonso", rol: "usuario" },
  { usuario: "Nayeli", rol: "usuario" },
  { usuario: "Cass", rol: "usuario" },
  { usuario: "Karla", rol: "usuario" },
  { usuario: "Nora", rol: "usuario" },
  { usuario: "Pilar", rol: "usuario" },
  { usuario: "Adolfo", rol: "usuario" },
  { usuario: "Berenice", rol: "usuario" },
  { usuario: "Iñaki", rol: "usuario" },
  { usuario: "Julio", rol: "usuario" },
  // Rol "personal": solo ve las pestañas Coordinadores y Administración, en solo lectura.
  { usuario: "Recepcion", rol: "personal" },
];

function generarPasswordTemporal() {
  return Math.random().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en .env");
  await query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

  console.log("\n=== Contraseñas temporales generadas (guárdalas, no se vuelven a mostrar) ===");
  for (const u of USUARIOS) {
    const passwordTemporal = generarPasswordTemporal();
    const r = await query(
      `insert into usuarios (usuario, password_hash, rol) values ($1,$2,$3) on conflict (usuario) do nothing`,
      [u.usuario, bcrypt.hashSync(passwordTemporal, 10), u.rol]
    );
    console.log(r.rowCount ? `- ${u.usuario}: ${passwordTemporal}` : `- ${u.usuario}: ya existía, se conserva su contraseña actual`);
  }
  console.log("===============================================================================\n");

  // Datos de ejemplo para "servicios". Para volver a cargarlos: npm run seed -- --reset-servicios
  if (process.argv.includes("--reset-servicios")) {
    await query("delete from servicios");
    console.log('Tabla "servicios" vaciada (--reset-servicios).');
  }
  const conteoServicios = (await query("select count(*)::int n from servicios")).rows[0].n;

  if (conteoServicios === 0) {
    const IVA = 1.16;
    const S = (dependencia, estado, empresa, unidades, op, sinIva, fechas, no_contrato, ejercicio_fiscal, estatus) => ({
      dependencia, estado, empresa, unidades,
      operarios_min: op[0], operarios_max: op[1],
      monto_min_sin_iva: sinIva[0], monto_max_sin_iva: sinIva[1],
      monto_min_con_iva: Math.round(sinIva[0] * IVA), monto_max_con_iva: Math.round(sinIva[1] * IVA),
      fecha_inicio: fechas ? fechas[0] : null, fecha_termino: fechas ? fechas[1] : null,
      no_contrato, ejercicio_fiscal, estatus,
    });

    const A = "Armot Limpieza";
    const B = "Servicios Integrales Armot";
    const C = "Grupo Clean MX";

    const SERVICIOS_EJEMPLO = [
      S("ISSSTE", "Ciudad de México", A, 12, [24, 36], [850000, 1200000], ["2026-01-01", "2026-12-31"], "ISSSTE-2026-014", "2026", "Vigente"),
      S("ISSSTE", "México", A, 8, [16, 22], [520000, 760000], ["2026-02-01", "2027-01-31"], "ISSSTE-2026-021", "2026", "Vigente"),
      S("Oficialía Mayor", "México", B, 64, [96, 128], [3200000, 4100000], ["2026-02-01", "2026-12-31"], "OM-2026-002", "2026", "Vigente"),
      S("Oficialía Mayor", "Ciudad de México", B, 20, [30, 44], [1100000, 1500000], ["2026-03-01", "2027-02-28"], "OM-2026-009", "2026", "Vigente"),
      S("Poder Judicial", "México", A, 24, [40, 52], [1450000, 1900000], ["2026-03-01", "2026-12-31"], "PJEM-2026-007", "2026", "Vigente"),
      S("Poder Judicial", "Hidalgo", C, 10, [14, 18], [600000, 780000], ["2026-04-01", "2026-09-30"], "PJEM-2026-011", "2026", "Concluido"),
      S("ISEM", "México", A, 38, [60, 80], [2100000, 2700000], ["2026-01-15", "2026-12-31"], "ISEM-2026-003", "2026", "En renovación"),
      S("ISEM", "Querétaro", C, 15, [22, 30], [900000, 1200000], ["2026-05-01", "2027-04-30"], "ISEM-2026-015", "2026", "Vigente"),
      S("IMSS", "Ciudad de México", B, 30, [48, 64], [1900000, 2500000], ["2026-01-01", "2026-06-30"], "IMSS-2026-004", "2026", "Concluido"),
      S("IMSS", "Puebla", C, 18, [26, 36], [1000000, 1400000], ["2026-06-01", "2027-05-31"], "IMSS-2026-018", "2026", "Vigente"),
      S("SEP", "Ciudad de México", B, 28, [40, 56], [1700000, 2200000], ["2026-02-15", "2027-02-14"], "SEP-2026-008", "2026", "Vigente"),
      S("CONAGUA", "Puebla", C, 6, [8, 10], [300000, 400000], null, "CONAGUA-2026-001", "2026", "En renovación"),
      S("SEP", "México", A, 45, [70, 95], [2600000, 3400000], ["2025-01-01", "2025-12-31"], "SEP-2025-006", "2025", "Concluido"),
    ];

    const cols = Object.keys(SERVICIOS_EJEMPLO[0]);
    for (const f of SERVICIOS_EJEMPLO) {
      await query(`insert into servicios (${cols.join(",")}) values (${cols.map((_, i) => "$" + (i + 1)).join(",")})`, cols.map((c) => f[c]));
    }
    console.log(`Insertados ${SERVICIOS_EJEMPLO.length} registros de ejemplo en "servicios".`);
  } else {
    console.log(`La tabla "servicios" ya tiene ${conteoServicios} registros, no se insertaron datos de ejemplo.`);
  }
  console.log("Siembra completa.");
  await getPool().end();
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
