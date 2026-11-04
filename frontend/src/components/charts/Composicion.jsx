import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { PALETA, fmtValor } from "../../lib/resumen";

function Celda({ x, y, width, height, name, padre, value, depth, colorIdx, metNombre }) {
  if (depth === 0 || width < 4 || height < 4) return null;
  const color = PALETA[(colorIdx ?? 0) % PALETA.length];
  if (depth === 1) {
    // Contenedor de la dependencia: solo el marco; el texto lo llevan las celdas hijas.
    return <rect x={x} y={y} width={width} height={height} fill="none" stroke="var(--card)" strokeWidth={3} />;
  }
  const corto = (t, w) => String(t).slice(0, Math.max(3, Math.floor(w / 6.5)));
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={color} fillOpacity={0.88} stroke="var(--card)" strokeWidth={1.5} />
      {width > 58 && height > 34 && (
        <>
          <text x={x + 7} y={y + 16} fill="#fff" fontSize={11} fontWeight={700}>{corto(padre, width - 10)}</text>
          {height > 50 && name !== "—" && <text x={x + 7} y={y + 31} fill="#fff" fontSize={11} opacity={0.9}>{corto(name, width - 10)}</text>}
          <text x={x + 7} y={y + (height > 50 && name !== "—" ? 46 : 31)} fill="#fff" fontSize={11}>{fmtValor(metNombre, value)}</text>
        </>
      )}
    </g>
  );
}

export default function Composicion({ datos, metNombre, alto }) {
  if (!datos.length) return <div className="aviso">Sin valores positivos para mostrar la composición.</div>;
  const data = datos.map((g, i) => ({ ...g, colorIdx: i, children: g.children.map((c) => ({ ...c, padre: g.name, colorIdx: i })) }));
  return (
    <div style={{ width: "100%", height: alto }}>
      <ResponsiveContainer>
        <Treemap data={data} dataKey="size" nameKey="name" isAnimationActive={false} content={<Celda metNombre={metNombre} />}>
          <Tooltip
            formatter={(v) => [fmtValor(metNombre, v), metNombre]}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
