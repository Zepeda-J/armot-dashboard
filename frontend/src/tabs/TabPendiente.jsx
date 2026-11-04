import Banner from "../components/Banner";

export default function TabPendiente({ icono, titulo, subtitulo, pills = [] }) {
  const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Banner icono={icono} titulo={titulo} subtitulo={subtitulo} pills={[...pills, `🗓️ ${hoy}`]} />
      <div className="empty">
        <b>Módulo en construcción</b>
        Este tablero se migra en la siguiente etapa.
      </div>
    </div>
  );
}
