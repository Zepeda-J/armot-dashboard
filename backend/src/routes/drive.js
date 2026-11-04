const express = require("express");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function obtenerClienteDrive() {
  const rutaCredenciales = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!rutaCredenciales) return null;

  const rutaAbsoluta = path.resolve(process.cwd(), rutaCredenciales);
  if (!fs.existsSync(rutaAbsoluta)) return null;

  const credenciales = JSON.parse(fs.readFileSync(rutaAbsoluta, "utf-8"));
  const auth = new google.auth.GoogleAuth({ credentials: credenciales, scopes: SCOPES });
  return google.drive({ version: "v3", auth });
}

function iconoPorMime(mimeType) {
  if (mimeType.includes("folder")) return { icon: "folder", type: "folder" };
  if (mimeType.includes("pdf")) return { icon: "picture_as_pdf", type: "pdf" };
  if (mimeType.includes("spreadsheet")) return { icon: "table_chart", type: "sheet" };
  if (mimeType.includes("document")) return { icon: "description", type: "doc" };
  if (mimeType.includes("image")) return { icon: "image", type: "image" };
  return { icon: "insert_drive_file", type: "file" };
}

// Construye recursivamente el árbol de carpetas/archivos, igual que
// construir_arbol_drive() en el Streamlit original.
async function construirArbol(drive, folderId, nombreCarpeta = "Raíz") {
  const respuesta = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, thumbnailLink, size, modifiedTime)",
    pageSize: 200,
  });

  const items = respuesta.data.files || [];
  const carpetas = [];
  const archivos = [];

  for (const item of items) {
    if (item.mimeType === "application/vnd.google-apps.folder") {
      carpetas.push(await construirArbol(drive, item.id, item.name));
    } else {
      const { icon, type } = iconoPorMime(item.mimeType);
      archivos.push({
        id: item.id,
        name: item.name,
        icon,
        type,
        size: item.size ? `${Math.round(item.size / 1024)} KB` : "—",
        date: item.modifiedTime ? item.modifiedTime.slice(0, 10) : "",
        url: item.webViewLink ? item.webViewLink.replace("/view", "/preview") : "",
        previewImg: item.thumbnailLink || "",
      });
    }
  }

  return { id: folderId, name: nombreCarpeta, folders: carpetas, files: archivos };
}

router.get("/tree", requireAuth, requireRole("admin", "usuario"), async (req, res) => {
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!folderId) {
    return res.status(200).json({ configurado: false, mensaje: "Falta GOOGLE_DRIVE_ROOT_FOLDER_ID en el backend." });
  }

  const drive = obtenerClienteDrive();
  if (!drive) {
    return res.status(200).json({
      configurado: false,
      mensaje: "Falta la credencial de la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON).",
    });
  }

  try {
    const arbol = await construirArbol(drive, folderId, "Google Drive");
    res.json({ configurado: true, arbol });
  } catch (err) {
    console.error("Error al leer Google Drive:", err);
    res.status(502).json({ error: "No se pudo leer la estructura de Google Drive." });
  }
});

module.exports = router;
