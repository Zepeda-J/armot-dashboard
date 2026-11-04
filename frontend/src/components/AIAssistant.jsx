import { useState } from "react";
import { api } from "../api";

export default function AIAssistant() {
  const [historial, setHistorial] = useState([]);
  const [pregunta, setPregunta] = useState("");
  const [pensando, setPensando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto) return;
    setHistorial((h) => [...h, { role: "user", content: texto }]);
    setPregunta("");
    setPensando(true);
    try {
      const d = await api.preguntarIA(texto);
      setHistorial((h) => [...h, { role: "assistant", content: d.respuesta }]);
    } catch (err) {
      setHistorial((h) => [...h, { role: "assistant", content: `⚠️ ${err.message}` }]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="ai">
      <h3>🤖 Asistente de IA Armot</h3>
      <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Pregúntame estadísticas o dudas sobre el reporte de servicios.</p>
      <div className="ai-msgs">
        {historial.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>{m.content}</div>)}
        {pensando && <div className="ai-msg assistant">Pensando…</div>}
      </div>
      <form className="ai-form" onSubmit={enviar}>
        <input className="input" value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="¿Qué deseas saber de los datos?" />
        <button className="btn btn-primary" type="submit" disabled={pensando}>➤</button>
      </form>
    </div>
  );
}
