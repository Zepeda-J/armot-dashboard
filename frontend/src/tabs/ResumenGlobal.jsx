import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Banner from "../components/Banner";
import Kpis from "../components/Kpis";
import Modal from "../components/Modal";
import MultiSelect from "../components/MultiSelect";
import Ranking from "../components/charts/Ranking";
import Composicion from "../components/charts/Composicion";
import Vigencia from "../components/charts/Vigencia";
import Dispersion from "../components/charts/Dispersion";
import Detalle from "../components/charts/Detalle";
import {
  DIMENSIONES, METRICAS, VISTAS, COLOR_ESTATUS, ORDEN_ESTATUS, PERIODO_FISCAL_INICIAL,
  aniosDisponibles, filtrarPeriodo, calcularKpis, calcularInsights, ranking, detalle, composicion,
  dispersion, vigenciaDatos, mdp, moneda, entero, pct,
} from "../lib/resumen";

const FILTROS = [
  { clave: "estado", etiqueta: "Estado", vacio: "Todos" },
  { clave: "dependencia", etiqueta: "Dependencia", vacio: "Todas" },
  { clave: "empresa", etiqueta: "Empresa operando", vacio: "Todas" },
  { clave: "estatus", etiqueta: "Estatus", vacio: "Todos" },
];
const SIN_FILTROS = { estado: [], dependencia: [], empresa: [], estatus: [] };

const opciones = (rows, clave) => [...new Set(rows.map((r) => r[clave]).filter((v) => v != null && String(v).trim() !== "").map(String))].sort((a, b) => a.localeCompare(b, "es"));

function descargarCsv(rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]).filter((c) => c !== "id");
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "resumen_global_filtrado.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

function Segmentado({ opciones: ops, valor, onChange }) {
  return (
    <div className="seg" role="group">
      {ops.map((o) => (
        <button key={o} type="button" className={valor === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export default function ResumenGlobal() {
  const [rows, setRows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizaciones, setActualizaciones] = useState(1);
  const [hora, setHora] = useState("");

  const [periodo, setPeriodo] = useState(null); // se fija al cargar: 2026 si existe, si no "Todos"
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [dim, setDim] = useState("Dependencia");
  const [met, setMet] = useState("Monto máx. c/IVA");
  const [foco, setFoco] = useState("Todos");
  const [vista, setVista] = useState("Composición");
  const [ampliado, setAmpliado] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError("");
    api.obtenerServicios()
      .then((d) => {
        setRows(d.filas);
        setHora(new Date().toLocaleTimeString("es-MX", { hour12: false }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  const anios = useMemo(() => aniosDisponibles(rows), [rows]);
  useEffect(() => {
    if (periodo === null && rows.length) setPeriodo(anios.includes(PERIODO_FISCAL_INICIAL) ? String(PERIODO_FISCAL_INICIAL) : "Todos");
  }, [rows, anios, periodo]);

  // ---- Filtros en cascada: las opciones de cada filtro salen de lo que dejan los demás ----
  const dfPeriodo = useMemo(() => filtrarPeriodo(rows, periodo ?? "Todos"), [rows, periodo]);
  const aplicar = (base, excepto) =>
    base.filter((r) => FILTROS.every(({ clave }) => clave === excepto || filtros[clave].length === 0 || filtros[clave].includes(String(r[clave]))));
  const opcionesPor = (clave) => opciones(aplicar(dfPeriodo, clave), clave);

  const df = useMemo(() => aplicar(dfPeriodo), [dfPeriodo, filtros]); // eslint-disable-line react-hooks/exhaustive-deps
  const hayFiltros = FILTROS.some(({ clave }) => filtros[clave].length);
  const filtrosTxt = FILTROS.filter(({ clave }) => filtros[clave].length)
    .map(({ etiqueta, clave }) => `${etiqueta.replace(" operando", "")}: ${filtros[clave].slice(0, 2).join(", ")}${filtros[clave].length > 2 ? ` +${filtros[clave].length - 2}` : ""}`)
    .join(" · ");
  const periodoTxt = periodo === "Todos" || periodo === null ? "Todos los periodos" : `Ejercicio fiscal ${periodo}`;

  const kp = useMemo(() => calcularKpis(df), [df]);
  const ins = useMemo(() => calcularInsights(df), [df]);

  // ---- Panel de servicios ----
  const dimKey = DIMENSIONES[dim];
  const metKey = METRICAS[met];
  const serie = useMemo(() => ranking(df, dimKey, metKey), [df, dimKey, metKey]);
  useEffect(() => {
    if (foco !== "Todos" && !serie.some((s) => s.nombre === foco)) setFoco("Todos");
  }, [serie, foco]);
  const dfFoco = useMemo(() => (foco === "Todos" ? df : df.filter((r) => String(r[dimKey]).trim() === foco)), [df, dimKey, foco]);
  const kf = useMemo(() => calcularKpis(dfFoco), [dfFoco]);

  // Se remonta cuando cambian los filtros para repetir la animación de entrada (como anim0/anim1 en Streamlit).
  const firma = `${periodo}|${JSON.stringify(filtros)}`;
  const firmaPanel = `${firma}|${dim}|${met}|${foco}`;

  const hoyTxt = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  const iva = (a, b) => `▲ ${mdp(a - b)} de IVA`;
  const pctMax = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}% del máximo` : "—");
  const tope = Math.max(kp.max_con, kp.max_sin, 1);

  const kpisMontos = [
    { etiqueta: "Mínimo sin IVA", icono: "🪙", color: "#64748b", valor: mdp(kp.min_sin), detalle: pctMax(kp.min_sin, kp.max_sin), porcentaje: (kp.min_sin / tope) * 100, titulo: moneda(kp.min_sin) },
    { etiqueta: "Máximo sin IVA", icono: "💼", color: "#2563eb", valor: mdp(kp.max_sin), detalle: "Base antes de IVA", porcentaje: (kp.max_sin / tope) * 100, titulo: moneda(kp.max_sin) },
    { etiqueta: "Mínimo con IVA", icono: "🧾", color: "#0d9488", valor: mdp(kp.min_con), detalle: iva(kp.min_con, kp.min_sin), porcentaje: (kp.min_con / tope) * 100, titulo: moneda(kp.min_con) },
    { etiqueta: "Máximo con IVA", icono: "💰", color: "#16a34a", valor: mdp(kp.max_con), detalle: iva(kp.max_con, kp.max_sin), porcentaje: (kp.max_con / tope) * 100, titulo: moneda(kp.max_con) },
  ];
  const kpisFoco = [
    { etiqueta: "Unidades", icono: "🏢", color: "#2563eb", valor: entero(kf.unidades), detalle: `${pct(kf.unidades, kp.unidades).toFixed(0)}% del total`, porcentaje: pct(kf.unidades, kp.unidades) },
    { etiqueta: "Contratos", icono: "📄", color: "#0d9488", valor: kf.contratos, detalle: `${pct(kf.contratos, kp.contratos).toFixed(0)}% del total`, porcentaje: pct(kf.contratos, kp.contratos) },
    { etiqueta: "Operarios máx.", icono: "👷", color: "#8b5cf6", valor: entero(kf.op_max), detalle: `${pct(kf.op_max, kp.op_max).toFixed(0)}% del total`, porcentaje: pct(kf.op_max, kp.op_max) },
    { etiqueta: "Monto máx. c/IVA", icono: "💰", color: "#16a34a", valor: mdp(kf.max_con), detalle: `${pct(kf.max_con, kp.max_con).toFixed(0)}% del total`, porcentaje: pct(kf.max_con, kp.max_con) },
    { etiqueta: "Cobertura", icono: "🗺️", color: "#f59e0b", valor: `${kf.entidades} · ${kf.estados}`, detalle: "dependencias · estados", porcentaje: null },
  ];

  const resumenChips = [
    ["🏛️", kp.entidades, "Entidades"], ["🗺️", kp.estados, "Estados"], ["🏢", entero(kp.unidades), "Unidades"], ["📄", kp.contratos, "Contratos"],
    ["👷", entero(kp.op_min), "Elem. mín."], ["👷", entero(kp.op_max), "Elem. máx."],
  ];

  function renderVista(grande, alto) {
    if (vista === "Composición") return <Composicion datos={composicion(dfFoco, dimKey, metKey, met)} metNombre={met} alto={alto} />;
    if (vista === "Vigencia") return <Vigencia datos={vigenciaDatos(dfFoco, grande)} grande={grande} />;
    if (vista === "Dispersión") return <Dispersion datos={dispersion(dfFoco)} alto={alto} grande={grande} />;
    return <Detalle datos={detalle(dfFoco, dim)} alto={alto} />;
  }

  const sinDatos = !cargando && df.length === 0;
  const conectado = !error && rows.length > 0;
  const vig = ins.vig;
  const vigTotal = vig ? Object.values(vig).reduce((a, b) => a + b, 0) : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Banner
        icono="📈"
        titulo="Resumen Global"
        subtitulo={`Servicios y contratos · ${periodoTxt}${filtrosTxt ? " · 🔎 " + filtrosTxt : ""}`}
        pills={[`🗓️ ${hoyTxt}`, <><span className="dot" />Live · filtros en tiempo real</>]}
      />
      {error && <div className="aviso" style={{ color: "var(--red)" }}>{error}</div>}

      <div className="rg">
        {/* ============ Panel de controles ============ */}
        <aside className="panel">
          <div className="panel-tit">Filtros</div>
          <div className="field">
            <span className="field-label">Periodo fiscal</span>
            <Segmentado opciones={[...anios.map(String), "Todos"]} valor={periodo ?? "Todos"} onChange={setPeriodo} />
          </div>
          {FILTROS.map(({ clave, etiqueta, vacio }) => (
            <MultiSelect
              key={clave}
              etiqueta={etiqueta}
              vacio={vacio}
              opciones={opcionesPor(clave)}
              seleccion={filtros[clave]}
              onChange={(v) => setFiltros((f) => ({ ...f, [clave]: v }))}
            />
          ))}
          {hayFiltros && <button className="btn btn-block" onClick={() => setFiltros(SIN_FILTROS)}>🧹 Limpiar filtros</button>}

          <div className="panel-tit">Resumen</div>
          <div className="chips">
            {resumenChips.map(([i, v, e]) => (
              <div className="chip" key={e}>
                <span className="chip-ico">{i}</span>
                <div><div className="chip-val">{v}</div><div className="chip-lbl">{e}</div></div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-block" onClick={() => { cargar(); setActualizaciones((n) => n + 1); }} disabled={cargando}>
            🔄 {cargando ? "Actualizando…" : "Actualizar datos"}
          </button>
          <button className="btn btn-block" onClick={() => descargarCsv(df)} disabled={!df.length}>⬇️ Exportar vista (CSV)</button>
        </aside>

        {/* ============ Tablero ============ */}
        <div className="rg-main">
          <div key={firma} style={{ display: "grid", gap: 16 }}>
            <Kpis items={kpisMontos} />
            <div className="insights">
              <div className="insight" style={{ "--i": 0 }}>
                <div className="eyebrow">🏆 Dependencia líder</div>
                <div className="insight-val" title={ins.dep?.nombre}>{ins.dep ? ins.dep.nombre : "—"}</div>
                <div className="insight-sub">{ins.dep ? `${mdp(ins.dep.monto)} · ${ins.dep.pct.toFixed(1)}% del total` : "Sin datos"}</div>
              </div>
              <div className="insight" style={{ "--i": 1 }}>
                <div className="eyebrow">📍 Estado líder</div>
                <div className="insight-val" title={ins.est?.nombre}>{ins.est ? ins.est.nombre : "—"}</div>
                <div className="insight-sub">{ins.est ? `${mdp(ins.est.monto)} · ${ins.est.pct.toFixed(1)}% del total` : "Sin datos"}</div>
              </div>
              <div className="insight" style={{ "--i": 2 }}>
                <div className="eyebrow">🎯 Concentración</div>
                <div className="insight-val">{ins.top3 ? `${ins.top3.pct.toFixed(1)}%` : "—"}</div>
                <div className="insight-sub">{ins.top3 ? `del monto en las ${ins.top3.n} mayores` : "Sin datos"}</div>
              </div>
              <div className="insight" style={{ "--i": 3 }}>
                <div className="eyebrow">🚦 Vigencia</div>
                {vigTotal > 0 ? (
                  <>
                    <div className="sem">
                      {ORDEN_ESTATUS.filter((n) => vig[n]).map((n) => <span key={n} style={{ width: `${(vig[n] / vigTotal) * 100}%`, background: COLOR_ESTATUS[n] }} />)}
                    </div>
                    <div className="sem-leg">
                      {ORDEN_ESTATUS.filter((n) => vig[n]).map((n) => <span key={n}><i style={{ background: COLOR_ESTATUS[n] }} />{vig[n]} {n.toLowerCase()}</span>)}
                    </div>
                  </>
                ) : (
                  <><div className="insight-val">—</div><div className="insight-sub">Sin fechas válidas</div></>
                )}
              </div>
            </div>
          </div>

          {sinDatos ? (
            <div className="aviso">No hay datos para el panel de servicios con los filtros actuales.</div>
          ) : (
            <section className="servicios">
              <button className="btn btn-icon zoom" onClick={() => setAmpliado(true)} title="Ampliar este panel" aria-label="Ampliar este panel">🔍</button>
              <div className="servicios-ctl">
                <div className="field"><span className="field-label">Desglosar por</span><Segmentado opciones={Object.keys(DIMENSIONES)} valor={dim} onChange={setDim} /></div>
                <div className="field"><span className="field-label">Medir</span><Segmentado opciones={Object.keys(METRICAS)} valor={met} onChange={setMet} /></div>
                <div className="field">
                  <span className="field-label">Enfocar en</span>
                  <select className="select" value={foco} onChange={(e) => setFoco(e.target.value)}>
                    <option value="Todos">Todos</option>
                    {serie.map((s) => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="ph">
                <span className="ph-tit">Servicios · desglose por {dim.toLowerCase()}</span>
                <span className="ph-chip">Foco: {foco}</span>
                <span className="ph-chip">{periodoTxt}</span>
              </div>
              <div key={firmaPanel}><Kpis items={kpisFoco} /></div>

              <div className="servicios-cols">
                <div className="chart-box">
                  <div className="sub-tit">{met} · por {dim.toLowerCase()}</div>
                  <Ranking datos={serie} metNombre={met} foco={foco} grande={false} alto={340} />
                </div>
                <div className="chart-box">
                  <div style={{ marginBottom: 10 }}><Segmentado opciones={VISTAS} valor={vista} onChange={setVista} /></div>
                  {renderVista(false, 340)}
                </div>
              </div>
            </section>
          )}

          <div className="statusbar">
            <span>
              <span className={`dot ${conectado ? "" : "rojo"}`} />
              {conectado ? `Conectado · Base de datos · ${kp.filas.toLocaleString("es-MX")} filas en vista` : "Sin datos / sin conexión"}
            </span>
            <span>{periodoTxt} · actualización #{actualizaciones} · {hora}</span>
          </div>
        </div>
      </div>

      {ampliado && (
        <Modal titulo="🔍 Vista ampliada" onClose={() => setAmpliado(false)}>
          <div>
            <div className="sub-tit">Desglose por {dim.toLowerCase()} · {met}</div>
            <Ranking datos={serie} metNombre={met} foco={foco} grande alto={420} />
          </div>
          <div>
            <div style={{ marginBottom: 10 }}><Segmentado opciones={VISTAS} valor={vista} onChange={setVista} /></div>
            {renderVista(true, 520)}
          </div>
        </Modal>
      )}
    </div>
  );
}
