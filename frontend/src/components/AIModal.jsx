import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Markdown from "./Markdown";
import GraficaIA from "./charts/GraficaIA";

const SUGERENCIAS = [
  "Gráfica del monto máximo con IVA por dependencia",
  "Distribución de contratos por estatus",
  "¿Qué estado concentra más unidades? Muéstrame un comparativo",
];

export default function AIModal({ mensajes, pensando, onEnviar, onNueva, onClose }) {
  const [pregunta, setPregunta] = useState("");
  const finRef = useRef(null);
  const ultimaRespRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Una respuesta nueva se muestra desde su inicio (puede traer varias gráficas); lo demás baja al final.
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1];
    if (!pensando && ultimo?.role === "assistant" && ultimaRespRef.current) {
      ultimaRespRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [mensajes, pensando]);

  function enviar(e) {
    e.preventDefault();
    const t = pregunta.trim();
    if (!t || pensando) return;
    setPregunta("");
    onEnviar(t);
  }

  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal ia-modal" role="dialog" aria-modal="true" aria-label="Asistente de IA">
        <div className="modal-head">
          <h2>🤖 Asistente de IA Armot</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {mensajes.length > 0 && <button className="btn" onClick={onNueva} disabled={pensando}>🗑️ Nueva conversación</button>}
            <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>

        <div className="ia-hilo">
          {mensajes.length === 0 && (
            <div className="ia-vacio">
              <p>Pregúntame sobre el reporte de servicios. Si pides una estadística o una gráfica, la verás aquí.</p>
              <div className="ia-sugs">
                {SUGERENCIAS.map((s) => <button key={s} className="btn" onClick={() => onEnviar(s)} disabled={pensando}>{s}</button>)}
              </div>
            </div>
          )}
          {mensajes.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ia-burbuja user">{m.content}</div>
            ) : (
              <div key={i} ref={i === mensajes.length - 1 ? ultimaRespRef : null} className={`ia-burbuja assistant ${m.error ? "error" : ""}`}>
                <Markdown texto={m.content} />
                {m.graficas?.length > 0 && <div className="ia-graficas">{m.graficas.map((g, j) => <GraficaIA key={j} g={g} />)}</div>}
              </div>
            )
          )}
          {pensando && <div className="ia-burbuja assistant"><span className="ia-puntos" aria-label="Analizando los datos"><i /><i /><i /></span></div>}
          <div ref={finRef} />
        </div>

        <form className="ia-form" onSubmit={enviar}>
          <input ref={inputRef} className="input" value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="Escribe tu pregunta o pide una gráfica…" maxLength={1000} />
          <button className="btn btn-primary" type="submit" disabled={pensando || !pregunta.trim()}>Enviar ➤</button>
        </form>
      </div>
    </div>,
    document.body
  );
}
