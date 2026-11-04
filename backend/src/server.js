require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const serviciosRoutes = require("./routes/servicios");
const aiRoutes = require("./routes/ai");
const driveRoutes = require("./routes/drive");
const tablerosRoutes = require("./routes/tableros");
const personalRoutes = require("./routes/personal");
const { configurado: supabaseConfigurado } = require("./db/supabase");

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET en el archivo .env. Copia .env.example a .env y configúralo.");
  process.exit(1);
}

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
// Límite mayor porque las fotos de perfil viajan en base64 (máx. 3 MB por foto).
app.use(express.json({ limit: "6mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, supabase: supabaseConfigurado() }));

app.use("/api/auth", authRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/drive", driveRoutes);
app.use("/api/tableros", tablerosRoutes);
app.use("/api/personal", personalRoutes);

// Manejo genérico de errores no capturados en las rutas.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend Armot escuchando en http://localhost:${PORT}`);
  if (!supabaseConfigurado()) console.log("Aviso: DATABASE_URL vacío — Coordinadores, Administración, Facturación y Acuerdos no tendrán datos.");
});
