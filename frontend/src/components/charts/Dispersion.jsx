import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { PALETA, entero } from "../../lib/resumen";

export default function Dispersion({ datos, alto, grande }) {
  if (!datos.length) return <div className="aviso">No hay datos para la gráfica de dispersión.</div>;
  return (
    <div style={{ width: "100%", height: alto }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis type="number" dataKey="unidades" name="Unidades" tick={{ fontSize: 11, fill: "currentColor" }} label={{ value: "Número de unidades", position: "insideBottom", offset: -10, fontSize: 11, fill: "currentColor" }} />
          <YAxis type="number" dataKey="monto" name="Monto" tickFormatter={(v) => `$${v.toFixed(0)} M`} tick={{ fontSize: 11, fill: "currentColor" }} width={64} />
          <ZAxis type="number" dataKey="operarios" range={grande ? [120, 1400] : [60, 600]} name="Operarios máx." />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(v, n) => (n === "Monto" ? [`$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 2 })} M`, n] : [entero(v), n])}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }}
          />
          {grande && <Legend />}
          {datos.map((d, i) => (
            <Scatter key={d.nombre} name={d.nombre} data={[d]} fill={PALETA[i % PALETA.length]} fillOpacity={0.85} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
