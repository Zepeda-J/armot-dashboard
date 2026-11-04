import { useEffect, useState } from "react";
import { api } from "../api";
import Banner from "../components/Banner";

const ICONO = { pdf: "📕", sheet: "📗", doc: "📘", image: "🖼️", file: "📄" };

export default function Contratos() {
  const [estado, setEstado] = useState({ cargando: true, error: "", arbol: null, configurado: true, mensaje: "" });
  const [ruta, setRuta] = useState([]);
  const [hora, setHora] = useState("");

  useEffect(() => {
    api.obtenerArbolDrive()
      .then((d) => {
        setHora(new Date().toLocaleTimeString("es-MX", { hour12: false }));
        if (!d.configurado) return setEstado({ cargando: false, error: "", arbol: null, configurado: false, mensaje: d.mensaje });
        setEstado({ cargando: false, error: "", arbol: d.arbol, configurado: true, mensaje: "" });
        setRuta([d.arbol]);
      })
      .catch((e) => setEstado({ cargando: false, error: e.message, arbol: null, configurado: true, mensaje: "" }));
  }, []);

  const actual = ruta[ruta.length - 1];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Banner
        icono="📁"
        titulo="Contratos"
        subtitulo={`Expediente digital · ${estado.arbol?.name || "Google Drive"}`}
        pills={["🔒 Solo lectura", `🔄 Leído a las ${hora || "—"}`]}
      />
      {estado.cargando && <div className="aviso">Cargando estructura de Google Drive…</div>}
      {estado.error && <div className="aviso" style={{ color: "var(--red)" }}>{estado.error}</div>}
      {!estado.configurado && <div className="empty"><b>Google Drive sin configurar</b>{estado.mensaje}</div>}

      {actual && (
        <div>
          <div className="breadcrumb">
            {ruta.map((c, i) => (
              <span key={c.id + i} className={i === ruta.length - 1 ? "cur" : ""} onClick={() => setRuta(ruta.slice(0, i + 1))}>
                {c.name}{i < ruta.length - 1 ? " /" : ""}
              </span>
            ))}
          </div>
          {actual.folders?.length > 0 && (
            <>
              <div className="grupo">Carpetas <span>{actual.folders.length}</span></div>
              <div className="drive-grid">
                {actual.folders.map((c) => (
                  <div key={c.id} className="drive-card" onClick={() => setRuta([...ruta, c])}>
                    <span className="drive-ico">📂</span>{c.name}
                  </div>
                ))}
              </div>
            </>
          )}
          {actual.files?.length > 0 && (
            <>
              <div className="grupo">Archivos <span>{actual.files.length}</span></div>
              <div className="drive-grid">
                {actual.files.map((f) => (
                  <a key={f.id} className="drive-card" href={f.url || "#"} target="_blank" rel="noreferrer">
                    <span className="drive-ico">{ICONO[f.type] || ICONO.file}</span>{f.name}
                    <small>{f.size} · {f.date}</small>
                  </a>
                ))}
              </div>
            </>
          )}
          {!actual.folders?.length && !actual.files?.length && <div className="empty"><b>Carpeta vacía</b>Esta carpeta no contiene archivos.</div>}
        </div>
      )}
    </div>
  );
}
