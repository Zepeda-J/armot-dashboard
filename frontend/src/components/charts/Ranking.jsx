import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { fmtValor, esMonto, topConOtros } from "../../lib/resumen";

const COLOR_FOCO = "#2563eb";
const COLOR_APAGADO = "rgba(148,163,184,0.45)";

function colorEscala(t) {
  // Degradado azul claro → azul marino, como la escala del Streamlit.
  const a = [147, 197, 253];
  const b = [37, 99, 235];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function Ranking({ datos, metNombre, foco, grande, alto }) {
  if (!datos.length) return <div className="aviso">Sin datos para este desglose.</div>;
  const esc = esMonto(metNombre) ? 1e6 : 1;
  const base = grande ? datos : topConOtros(datos, foco);
  const filas = base.map((d) => ({ nombre: d.nombre, valor: d.valor / esc }));
  const max = Math.max(...filas.map((f) => f.valor), 0.0001);
  const altoReal = grande ? Math.max(alto, filas.length * 34 + 30) : Math.max(alto, filas.length * 30 + 20);

  return (
    <div style={{ width: "100%", height: altoReal }}>
      <ResponsiveContainer>
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 84, bottom: 4, left: 4 }} barCategoryGap="28%">
          <XAxis type="number" hide domain={[0, max * 1.05]} />
          <YAxis type="category" dataKey="nombre" width={grande ? 190 : 120} tick={{ fontSize: grande ? 12 : 11, fill: "currentColor" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(128,128,128,0.1)" }}
            formatter={(v) => [fmtValor(metNombre, v), metNombre]}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }}
          />
          <Bar dataKey="valor" radius={[0, 5, 5, 0]} isAnimationActive animationDuration={650}>
            {filas.map((f) => (
              <Cell key={f.nombre} fill={foco === "Todos" ? colorEscala(f.valor / max) : f.nombre === foco ? COLOR_FOCO : COLOR_APAGADO} />
            ))}
            <LabelList dataKey="valor" position="right" formatter={(v) => fmtValor(metNombre, v)} style={{ fontSize: grande ? 12 : 11, fill: "currentColor" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
