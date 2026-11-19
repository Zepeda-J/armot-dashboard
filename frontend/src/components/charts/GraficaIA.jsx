import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { PALETA, moneda } from "../../lib/resumen";
import { aCSV } from "../../lib/formato";

const TOOLTIP = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" };
const decimales = (v) => Number(v).toLocaleString("es-MX", { maximumFractionDigits: 2 });
const corto = (t, n = 16) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t));

function descargarCsv(g) {
  const csv = aCSV([g.dimension, g.metrica], g.datos.map((d) => ({ [g.dimension]: d.nombre, [g.metrica]: d.valor })));
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${g.titulo.replace(/[^\w\-]+/g, "_").slice(0, 60) || "grafica"}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function GraficaIA({ g }) {
  const dinero = g.unidad === "dinero";
  const etiqueta = (v) => (dinero ? `$${(v / 1e6).toLocaleString("es-MX", { maximumFractionDigits: 1 })} M` : decimales(v));
  const tip = (v) => [dinero ? moneda(v) : decimales(v), g.metrica];
  const muchos = g.datos.length > 6 || g.datos.some((d) => d.nombre.length > 12);
  const ejeY = (v) => (dinero ? `$${(v / 1e6).toFixed(1)}M` : decimales(v));

  let grafica;
  if (g.tipo === "pastel") {
    const total = g.datos.reduce((a, d) => a + d.valor, 0);
    grafica = (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={g.datos} dataKey="valor" nameKey="nombre" innerRadius={58} outerRadius={105} paddingAngle={2} label={(e) => `${((e.value / total) * 100).toFixed(0)}%`} labelLine={false}>
            {g.datos.map((d, i) => <Cell key={d.nombre} fill={PALETA[i % PALETA.length]} stroke="var(--card)" />)}
          </Pie>
          <Tooltip formatter={tip} contentStyle={TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  } else if (g.tipo === "linea") {
    grafica = (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={g.datos} margin={{ top: 16, right: 24, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "currentColor" }} />
          <YAxis tickFormatter={ejeY} tick={{ fontSize: 11, fill: "currentColor" }} width={64} />
          <Tooltip formatter={tip} contentStyle={TOOLTIP} />
          <Line type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }}>
            <LabelList dataKey="valor" position="top" formatter={etiqueta} style={{ fontSize: 11, fill: "currentColor" }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    );
  } else if (g.tipo === "barras_horizontales") {
    grafica = (
      <ResponsiveContainer width="100%" height={Math.max(260, g.datos.length * 34 + 30)}>
        <BarChart data={g.datos} layout="vertical" margin={{ top: 4, right: 84, bottom: 4, left: 4 }} barCategoryGap="26%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="nombre" width={150} tick={{ fontSize: 12, fill: "currentColor" }} tickFormatter={(t) => corto(t, 22)} axisLine={false} tickLine={false} />
          <Tooltip formatter={tip} cursor={{ fill: "rgba(128,128,128,0.1)" }} contentStyle={TOOLTIP} />
          <Bar dataKey="valor" fill="#2563eb" radius={[0, 5, 5, 0]}>
            <LabelList dataKey="valor" position="right" formatter={etiqueta} style={{ fontSize: 12, fill: "currentColor" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  } else {
    grafica = (
      <ResponsiveContainer width="100%" height={muchos ? 340 : 300}>
        <BarChart data={g.datos} margin={{ top: 22, right: 12, bottom: muchos ? 40 : 4, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "currentColor" }} interval={0} angle={muchos ? -30 : 0} textAnchor={muchos ? "end" : "middle"} tickFormatter={(t) => corto(t, muchos ? 14 : 20)} height={muchos ? 60 : 30} />
          <YAxis tickFormatter={ejeY} tick={{ fontSize: 11, fill: "currentColor" }} width={64} />
          <Tooltip formatter={tip} cursor={{ fill: "rgba(128,128,128,0.1)" }} contentStyle={TOOLTIP} />
          <Bar dataKey="valor" radius={[5, 5, 0, 0]}>
            {g.datos.map((d, i) => <Cell key={d.nombre} fill={PALETA[i % PALETA.length]} />)}
            <LabelList dataKey="valor" position="top" formatter={etiqueta} style={{ fontSize: 11, fill: "currentColor" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <figure className="ia-chart">
      <figcaption>
        <div>
          <div className="ia-chart-tit">{g.titulo}</div>
          <div className="ia-chart-sub">{g.metrica} · por {g.dimension.toLowerCase()} · {g.agregacion}</div>
        </div>
        <button className="btn btn-icon" onClick={() => descargarCsv(g)} title="Descargar datos (CSV)" aria-label="Descargar datos en CSV">⬇️</button>
      </figcaption>
      {grafica}
    </figure>
  );
}
