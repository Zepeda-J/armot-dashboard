import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { moneda, pct, hoyISO, sumarDiasISO } from "./formato";

export const ESTATUS_FACTURA = ["Por facturar", "Facturada", "Pagada", "Cancelada"];
export const ESTATUS_ACUERDO = ["Borrador", "En revisión", "Vigente", "Vencido", "Cancelado"];
export const DIAS_POR_VENCER = 90;

const COL_FACTURA = { "Por facturar": "#94a3b8", Facturada: "#f59e0b", Pagada: "#10b981", Cancelada: "#ef4444" };
const COL_ACUERDO = { Borrador: "#94a3b8", "En revisión": "#8b5cf6", Vigente: "#10b981", Vencido: "#ef4444", Cancelado: "#64748b" };
const PALETA = ["#2563eb", "#0d9488", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981"];

const tipTema = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" };
const num = (v) => Number(v) || 0;

const vencida = (f) => f["Estatus"] === "Facturada" && f["Vencimiento"] && f["Vencimiento"] < hoyISO();
const porVencer = (f) => f["Estatus"] === "Vigente" && f["Vigencia hasta"] && f["Vigencia hasta"] <= sumarDiasISO(hoyISO(), DIAS_POR_VENCER);

function Caja({ titulo, children }) {
  return (
    <div className="panel">
      <div className="panel-tit">{titulo}</div>
      {children}
    </div>
  );
}

function Dona({ datos, colores }) {
  const con = datos.filter((d) => d.value > 0);
  if (!con.length) return <div className="aviso">Sin datos para graficar.</div>;
  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={con} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" stroke="var(--card)" strokeWidth={2} isAnimationActive={false}
            label={({ percent }) => `${Math.round(percent * 100)}%`}>
            {con.map((d, i) => <Cell key={d.name} fill={colores[d.name] || PALETA[i % PALETA.length]} />)}
          </Pie>
          <Tooltip contentStyle={tipTema} formatter={(v, n) => [typeof v === "number" && v > 999 ? moneda(v) : v, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="legend" style={{ justifyContent: "center" }}>
        {con.map((d, i) => (
          <span key={d.name}><i className="dot" style={{ background: colores[d.name] || PALETA[i % PALETA.length] }} /> {d.name}</span>
        ))}
      </div>
    </div>
  );
}

function Barras({ datos, color, formato, horizontal }) {
  if (!datos.length) return <div className="aviso">Sin datos para graficar.</div>;
  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 18, right: horizontal ? 70 : 8, left: 4, bottom: 4 }}>
          {horizontal ? (
            <>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
            </>
          )}
          <Tooltip contentStyle={tipTema} cursor={{ fill: "var(--tint)" }} formatter={(v) => [formato ? formato(v) : v, ""]} />
          <Bar dataKey="value" radius={4} isAnimationActive={false}>
            {datos.map((d) => <Cell key={d.name} fill={d.color || color} />)}
            <LabelList dataKey="value" position={horizontal ? "right" : "top"} formatter={formato} style={{ fontSize: 11, fill: "var(--text)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const TABLEROS = {
  facturacion: {
    icono: "📑",
    titulo: "Seguimiento de facturación",
    subtitulo: "Facturación, cobranza y facturas vencidas en un solo tablero",
    estatus: ESTATUS_FACTURA,
    colEstatus: "Estatus",
    extras: { "⚠️ Vencidas": vencida },
    vacio: "Aún no hay facturas registradas. Usa ➕ Agregar o importa tu archivo desde ⬆️ Importar para ver aquí los indicadores de cobranza.",
    kpis(filas) {
      const monto = (e) => filas.filter((f) => f["Estatus"] === e).reduce((s, f) => s + num(f["Monto c/IVA"]), 0);
      const n = (e) => filas.filter((f) => f["Estatus"] === e).length;
      const facturado = monto("Facturada") + monto("Pagada");
      const venc = filas.filter(vencida);
      const montoVenc = venc.reduce((s, f) => s + num(f["Monto c/IVA"]), 0);
      return [
        { etiqueta: "Facturado", icono: "🧾", color: "#2563eb", valor: moneda(facturado), detalle: `${n("Facturada") + n("Pagada")} facturas`, porcentaje: null },
        { etiqueta: "Cobrado", icono: "✅", color: "#16a34a", valor: moneda(monto("Pagada")), detalle: `${pct(monto("Pagada"), facturado).toFixed(0)}% de lo facturado`, porcentaje: pct(monto("Pagada"), facturado) },
        { etiqueta: "Por cobrar", icono: "⏳", color: "#f59e0b", valor: moneda(monto("Facturada")), detalle: `${n("Facturada")} facturas abiertas`, porcentaje: pct(monto("Facturada"), facturado) },
        { etiqueta: "Vencido", icono: "⚠️", color: "#ef4444", valor: moneda(montoVenc), detalle: `${venc.length} facturas fuera de plazo`, porcentaje: pct(montoVenc, facturado) },
        { etiqueta: "Por facturar", icono: "📝", color: "#64748b", valor: moneda(monto("Por facturar")), detalle: `${n("Por facturar")} pendientes`, porcentaje: null },
      ];
    },
    visual(filas) {
      const porEstatus = ESTATUS_FACTURA.map((e) => ({ name: e, value: filas.filter((f) => f["Estatus"] === e).reduce((s, f) => s + num(f["Monto c/IVA"]), 0) }));
      const acc = {};
      filas.filter((f) => f["Estatus"] === "Facturada").forEach((f) => {
        const k = f["Dependencia"] || "(sin dependencia)";
        acc[k] = (acc[k] || 0) + num(f["Monto c/IVA"]);
      });
      const porCobrar = Object.entries(acc).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
      return (
        <div className="duo" style={{ "--a": 1, "--b": 1.4 }}>
          <Caja titulo="Importe por estatus"><Dona datos={porEstatus} colores={COL_FACTURA} /></Caja>
          <Caja titulo="Por cobrar · top dependencias">
            {porCobrar.length ? <Barras datos={porCobrar} color="#f59e0b" formato={moneda} horizontal /> : <div className="aviso">Sin facturas abiertas por cobrar.</div>}
          </Caja>
        </div>
      );
    },
  },

  acuerdos: {
    icono: "🤝",
    titulo: "Acuerdos y convenios",
    subtitulo: "Convenios con clientes y proveedores: vigencias, estatus y alertas",
    estatus: ESTATUS_ACUERDO,
    colEstatus: "Estatus",
    extras: { "⏳ Por vencer": porVencer },
    vacio: "Aún no hay acuerdos ni convenios registrados. Usa ➕ Agregar o importa tu archivo desde ⬆️ Importar para ver aquí vigencias y alertas.",
    kpis(filas) {
      const n = filas.length;
      const vig = filas.filter((f) => f["Estatus"] === "Vigente");
      const pv = filas.filter(porVencer);
      const tramite = filas.filter((f) => ["Borrador", "En revisión"].includes(f["Estatus"])).length;
      const cli = filas.filter((f) => f["Relación"] === "Cliente").length;
      const prov = filas.filter((f) => f["Relación"] === "Proveedor").length;
      return [
        { etiqueta: "Acuerdos", icono: "🤝", color: "#2563eb", valor: String(n), detalle: `${cli} con clientes · ${prov} con proveedores`, porcentaje: null },
        { etiqueta: "Vigentes", icono: "✅", color: "#16a34a", valor: String(vig.length), detalle: `${pct(vig.length, n).toFixed(0)}% del total`, porcentaje: pct(vig.length, n) },
        { etiqueta: `Por vencer (${DIAS_POR_VENCER} d)`, icono: "⏳", color: "#f59e0b", valor: String(pv.length), detalle: "vigentes que cierran pronto", porcentaje: pct(pv.length, vig.length) },
        { etiqueta: "En trámite", icono: "📝", color: "#8b5cf6", valor: String(tramite), detalle: "borradores y en revisión", porcentaje: pct(tramite, n) },
        { etiqueta: "Monto vigente", icono: "💰", color: "#0d9488", valor: moneda(vig.reduce((s, f) => s + num(f["Monto"]), 0)), detalle: "suma de acuerdos vigentes", porcentaje: null },
      ];
    },
    visual(filas) {
      const porEstatus = ESTATUS_ACUERDO.map((e) => ({ name: e, value: filas.filter((f) => f["Estatus"] === e).length, color: COL_ACUERDO[e] }));
      const rel = ["Cliente", "Proveedor"].map((r) => ({ name: r, value: filas.filter((f) => f["Relación"] === r).length }));
      return (
        <div className="duo" style={{ "--a": 1.4, "--b": 1 }}>
          <Caja titulo="Acuerdos por estatus"><Barras datos={porEstatus} color="#2563eb" /></Caja>
          <Caja titulo="Clientes vs. proveedores">
            {rel.some((r) => r.value) ? <Dona datos={rel} colores={{}} /> : <div className="aviso">Sin relación cliente/proveedor capturada.</div>}
          </Caja>
        </div>
      );
    },
  },
};
