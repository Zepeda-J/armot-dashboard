import { COLOR_ESTATUS, ORDEN_ESTATUS, fmtFecha } from "../../lib/resumen";

export default function Vigencia({ datos, grande }) {
  const { filas, hoy } = datos;
  if (!filas.length) return <div className="aviso">No hay fechas válidas para mostrar la vigencia.</div>;

  const min = Math.min(...filas.map((f) => f.ini.getTime()), hoy.getTime());
  const max = Math.max(...filas.map((f) => f.fin.getTime()), hoy.getTime());
  const rango = Math.max(max - min, 1);
  const pos = (t) => ((t - min) / rango) * 100;

  // Marcas del eje: ~6 meses repartidos
  const marcas = [];
  const d = new Date(min);
  d.setDate(1);
  const paso = Math.max(1, Math.round(rango / (30 * 864e5) / 6));
  while (d.getTime() <= max) {
    if (d.getTime() >= min) marcas.push(new Date(d));
    d.setMonth(d.getMonth() + paso);
  }

  const presentes = ORDEN_ESTATUS.filter((e) => filas.some((f) => f.estatus === e));

  return (
    <div>
      <div className="legend">
        {presentes.map((e) => (
          <span key={e}><i style={{ background: COLOR_ESTATUS[e] }} />{e}</span>
        ))}
        <span><i style={{ background: "transparent", border: "2px dotted var(--red)" }} />Hoy</span>
      </div>
      <div className="gantt" style={{ maxHeight: grande ? 560 : 300, overflow: "auto" }}>
        {filas.map((f, i) => (
          <div className="gantt-row" key={i} title={`${f.nombre}${f.contrato ? " · " + f.contrato : ""}\n${fmtFecha(f.ini)} → ${fmtFecha(f.fin)} · ${f.estatus}`}>
            <div className="gantt-name">{f.nombre}{grande && f.contrato ? <small style={{ color: "var(--muted)", fontWeight: 400 }}> · {f.contrato}</small> : null}</div>
            <div className="gantt-track">
              <div className="gantt-bar" style={{ left: `${pos(f.ini.getTime())}%`, width: `${Math.max(pos(f.fin.getTime()) - pos(f.ini.getTime()), 1.2)}%`, background: COLOR_ESTATUS[f.estatus] }} />
              <div className="gantt-hoy" style={{ left: `${pos(hoy.getTime())}%` }} />
            </div>
          </div>
        ))}
        <div className="gantt-axis">
          <span />
          <div className="gantt-ticks">
            {marcas.map((m, i) => (
              <span key={i} style={{ left: `${pos(m.getTime())}%` }}>{m.toLocaleDateString("es-MX", { month: "short", year: "2-digit" })}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
