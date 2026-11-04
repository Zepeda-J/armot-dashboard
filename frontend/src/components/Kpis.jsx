/** Tarjetas KPI. items: { etiqueta, icono, color, valor, detalle, porcentaje (0-100 | null), titulo } */
export default function Kpis({ items }) {
  return (
    <div className="kpis" style={{ "--cols": items.length > 4 ? Math.min(items.length, 6) : items.length }}>
      {items.map((k, i) => (
        <div className="kpi" key={k.etiqueta} style={{ "--ac": k.color, "--i": i }} title={k.titulo}>
          <div className="kpi-top">
            <span className="kpi-lbl">{k.etiqueta}</span>
            <span aria-hidden="true">{k.icono}</span>
          </div>
          <div className="kpi-val">{k.valor}</div>
          <div className="kpi-sub">{k.detalle}</div>
          {k.porcentaje != null && (
            <div className="kpi-bar">
              <span style={{ width: `${Math.max(0, Math.min(100, k.porcentaje)).toFixed(1)}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
