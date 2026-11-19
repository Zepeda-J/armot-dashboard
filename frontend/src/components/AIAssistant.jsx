import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import AIModal from "./AIModal";

// Avisa a Jarvis (control por voz) de que ya hay respuesta, para que la lea en voz alta.
const avisar = (detalle) => window.dispatchEvent(new CustomEvent("armot:ia-respuesta", { detail: detalle }));

// El historial vive aquí; las respuestas (texto y gráficas) se muestran en una ventana emergente.
export default function AIAssistant() {
  const [mensajes, setMensajes] = useState([]);
  const [pregunta, setPregunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const enviarRef = useRef(null);
  const pensandoRef = useRef(false);

  async function enviar(texto) {
    const t = texto.trim();
    if (!t || pensando) return;
    // Contexto para preguntas de seguimiento: los últimos mensajes, sin errores.
    const historial = mensajes.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMensajes((ms) => [...ms, { role: "user", content: t }]);
    setAbierto(true);
    setPensando(true);
    pensandoRef.current = true;
    try {
      const d = await api.preguntarIA(t, historial);
      setMensajes((ms) => [...ms, { role: "assistant", content: d.respuesta, graficas: d.graficas || [] }]);
      avisar({ respuesta: d.respuesta, nGraficas: (d.graficas || []).length });
    } catch (err) {
      setMensajes((ms) => [...ms, { role: "assistant", content: `⚠️ ${err.message}`, error: true }]);
      avisar({ error: true, respuesta: err.message });
    } finally {
      pensandoRef.current = false;
      setPensando(false);
    }
  }
  enviarRef.current = enviar;

  // Órdenes de voz de Jarvis: abrir/cerrar la ventana, nueva conversación o hacer una pregunta.
  useEffect(() => {
    const alOrden = (e) => {
      const { accion, texto } = e.detail || {};
      if (accion === "abrir") setAbierto(true);
      else if (accion === "cerrar") setAbierto(false);
      else if (accion === "nueva") { if (!pensandoRef.current) setMensajes([]); }
      else if (accion === "preguntar") {
        if (pensandoRef.current) avisar({ error: true, respuesta: "Sigo procesando tu pregunta anterior." });
        else enviarRef.current(texto);
      }
    };
    window.addEventListener("armot:ia", alOrden);
    return () => window.removeEventListener("armot:ia", alOrden);
  }, []);

  function desdeBarra(e) {
    e.preventDefault();
    const t = pregunta.trim();
    if (!t) return;
    setPregunta("");
    enviar(t);
  }

  return (
    <div className="ai">
      <h3>🤖 Asistente de IA Armot</h3>
      <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Pregúntame sobre contratos, coordinadores, administración, facturación o acuerdos. Las respuestas y gráficas se abren en una ventana.</p>
      <form className="ai-form" onSubmit={desdeBarra}>
        <input className="input" value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="¿Qué deseas saber de los datos?" maxLength={1000} />
        <button className="btn btn-primary" type="submit" disabled={pensando || !pregunta.trim()}>➤</button>
      </form>
      <button className="btn btn-block" onClick={() => setAbierto(true)}>
        💬 {mensajes.length ? `Ver conversación (${mensajes.filter((m) => m.role === "user").length})` : "Abrir asistente"}
      </button>

      {abierto && (
        <AIModal
          mensajes={mensajes}
          pensando={pensando}
          onEnviar={enviar}
          onNueva={() => setMensajes([])}
          onClose={() => setAbierto(false)}
        />
      )}
    </div>
  );
}
