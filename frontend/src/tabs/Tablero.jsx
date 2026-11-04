import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import Banner from "../components/Banner";
import Kpis from "../components/Kpis";
import Modal from "../components/Modal";
import { TABLEROS } from "../lib/tableros";
import { descargarCSV, fechaMx, leerCSV, moneda } from "../lib/formato";

const COLOR_ESTATUS = {
  "Por facturar": "#94a3b8", Facturada: "#f59e0b", Pagada: "#10b981", Cancelada: "#ef4444",
  Borrador: "#94a3b8", "En revisión": "#8b5cf6", Vigente: "#10b981", Vencido: "#ef4444", Cancelado: "#64748b",
};

function celda(campo, valor) {
  if (campo.t === "numero") return valor === null || valor === undefined ? "—" : moneda(valor);
  if (campo.t === "fecha") return fechaMx(valor);
  if (campo.t === "link") return valor ? <a href={valor} target="_blank" rel="noreferrer">🔗 Abrir</a> : "—";
  if (campo.n === "Estatus" && valor) return <span className="estatus-tag" style={{ "--c": COLOR_ESTATUS[valor] || "#64748b" }}>{valor}</span>;
  return valor || "—";
}

function Formulario({ campos, inicial, onGuardar, onCancelar, guardando, error }) {
  const [v, setV] = useState(() => {
    const base = {};
    campos.forEach((c) => {
      base[c.n] = inicial?.[c.n] ?? (c.t === "opcion" ? c.op[0] : "");
    });
    return base;
  });
  const cambiar = (n, valor) => setV((p) => ({ ...p, [n]: valor }));

  return (
    <div className="form-modal">
      <div className="form-grid">
        {campos.map((c) => (
          <label className="field" key={c.n}>
            <span className="field-label">{c.n}{c.req ? " *" : ""}</span>
            {c.t === "opcion" ? (
              <select className="select" value={v[c.n]} onChange={(e) => cambiar(c.n, e.target.value)}>
                {c.op.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input
                className="input"
                type={c.t === "numero" ? "number" : c.t === "fecha" ? "date" : c.t === "link" ? "url" : "text"}
                step={c.t === "numero" ? "0.01" : undefined}
                placeholder={c.t === "link" ? "https://…" : ""}
                value={v[c.n] ?? ""}
                onChange={(e) => cambiar(c.n, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-actions">
        <button className="btn" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onGuardar(v)} disabled={guardando}>{guardando ? "Guardando…" : "💾 Guardar"}</button>
      </div>
    </div>
  );
}

export default function Tablero({ clave }) {
  const cfg = TABLEROS[clave];
  const [estado, setEstado] = useState({ cargando: true, error: "", campos: [], filas: [] });
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [sel, setSel] = useState(new Set());
  const [modal, setModal] = useState(null); // { fila | null }
  const [guardando, setGuardando] = useState(false);
  const [errForm, setErrForm] = useState("");
  const [aviso, setAviso] = useState("");
  const inputArchivo = useRef(null);

  const cargar = useCallback(() => {
    api.tablero(clave)
      .then((d) => setEstado({ cargando: false, error: "", campos: d.campos, filas: d.filas }))
      .catch((e) => setEstado((p) => ({ ...p, cargando: false, error: e.message })));
  }, [clave]);

  useEffect(() => {
    setEstado({ cargando: true, error: "", campos: [], filas: [] });
    setFiltro("Todos"); setBusqueda(""); setSel(new Set());
    cargar();
  }, [cargar]);

  const { campos, filas } = estado;
  const datos = useMemo(() => filas.map((f) => ({ _id: f.id, ...f.datos })), [filas]);

  const opciones = ["Todos", ...cfg.estatus, ...Object.keys(cfg.extras)];
  const conteo = useMemo(() => {
    const c = { Todos: datos.length };
    cfg.estatus.forEach((e) => { c[e] = datos.filter((d) => d[cfg.colEstatus] === e).length; });
    Object.entries(cfg.extras).forEach(([e, fn]) => { c[e] = datos.filter(fn).length; });
    return c;
  }, [datos, cfg]);

  const vista = useMemo(() => {
    let r = datos;
    if (cfg.extras[filtro]) r = r.filter(cfg.extras[filtro]);
    else if (filtro !== "Todos") r = r.filter((d) => d[cfg.colEstatus] === filtro);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      const txt = campos.filter((c) => ["texto", "opcion", "link"].includes(c.t));
      r = r.filter((d) => txt.map((c) => d[c.n]).join(" ").toLowerCase().includes(q));
    }
    return r;
  }, [datos, filtro, busqueda, cfg, campos]);

  async function guardar(valores) {
    setGuardando(true); setErrForm("");
    try {
      if (modal.fila) await api.editarFila(clave, modal.fila._id, valores);
      else await api.agregarFilas(clave, [valores]);
      setModal(null);
      cargar();
    } catch (e) {
      setErrForm(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarSeleccion() {
    if (!window.confirm(`¿Eliminar ${sel.size} registro(s)? Esta acción no se puede deshacer.`)) return;
    try {
      await api.eliminarFilas(clave, [...sel]);
      setSel(new Set());
      setAviso("Registros eliminados.");
      cargar();
    } catch (e) {
      setAviso(e.message);
    }
  }

  async function importar(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    try {
      const filasCsv = leerCSV(await archivo.text());
      const nombres = campos.map((c) => c.n);
      if (!filasCsv.length || !nombres.some((n) => n in filasCsv[0])) {
        setAviso(`El archivo no tiene ninguna de las columnas esperadas: ${nombres.join(", ")}`);
        return;
      }
      if (!window.confirm(`Se agregarán ${filasCsv.length} fila(s) del archivo "${archivo.name}". ¿Continuar?`)) return;
      const r = await api.agregarFilas(clave, filasCsv, true);
      setAviso(`${r.agregadas} fila(s) importadas.`);
      cargar();
    } catch (err) {
      setAviso(`No se pudo importar: ${err.message}`);
    }
  }

  const exportar = () => descargarCSV(`${clave}.csv`, campos.map((c) => c.n), datos);
  const todasMarcadas = vista.length > 0 && vista.every((d) => sel.has(d._id));
  const alternarTodas = () => setSel(todasMarcadas ? new Set() : new Set(vista.map((d) => d._id)));
  const alternar = (id) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Banner icono={cfg.icono} titulo={cfg.titulo} subtitulo={cfg.subtitulo}
        pills={[`🗓️ ${new Date().toLocaleDateString("es-MX")}`, "☁️ Supabase"]} />

      {estado.cargando && <div className="aviso">Cargando información…</div>}
      {estado.error && <div className="aviso" style={{ color: "var(--red)" }}>{estado.error}</div>}

      {!estado.cargando && !estado.error && (
        <>
          <Kpis items={cfg.kpis(datos)} />
          {datos.length > 0 && cfg.visual(datos)}

          <div className="toolbar">
            <input className="input" style={{ maxWidth: 280 }} placeholder="🔎 Buscar en toda la tabla" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <div className="seg">
              {opciones.map((o) => (
                <button key={o} className={filtro === o ? "on" : ""} onClick={() => setFiltro(o)}>{o} ({conteo[o] ?? 0})</button>
              ))}
            </div>
            <span className="toolbar-sp" />
            <button className="btn btn-primary" onClick={() => { setErrForm(""); setModal({ fila: null }); }}>➕ Agregar</button>
            <button className="btn" onClick={() => inputArchivo.current?.click()}>⬆️ Importar</button>
            <button className="btn" onClick={exportar} disabled={!datos.length}>⬇️ Exportar</button>
            <input ref={inputArchivo} type="file" accept=".csv,text/csv" hidden onChange={importar} />
          </div>
          {aviso && <div className="nota" onClick={() => setAviso("")}>{aviso} <span style={{ opacity: 0.6 }}>(clic para cerrar)</span></div>}

          {!datos.length ? (
            <div className="empty">{cfg.vacio}</div>
          ) : (
            <>
              <div className="resumen-txt">
                Mostrando <b>{vista.length}</b> de <b>{datos.length}</b> registros
                {sel.size > 0 && (
                  <button className="btn" style={{ marginLeft: 12, color: "var(--red)", borderColor: "var(--red)" }} onClick={eliminarSeleccion}>🗑️ Eliminar {sel.size} marcado(s)</button>
                )}
              </div>
              {vista.length === 0 ? (
                <div className="aviso">Ningún registro coincide con la búsqueda o el filtro.</div>
              ) : (
                <div className="tbl-wrap" style={{ "--alto": "520px" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th><input type="checkbox" checked={todasMarcadas} onChange={alternarTodas} aria-label="Marcar todos" /></th>
                        <th />
                        {campos.map((c) => <th key={c.n} className={c.t === "numero" ? "num" : ""}>{c.n}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {vista.map((d) => (
                        <tr key={d._id}>
                          <td><input type="checkbox" checked={sel.has(d._id)} onChange={() => alternar(d._id)} aria-label="Marcar fila" /></td>
                          <td><button className="btn btn-icon" title="Editar" onClick={() => { setErrForm(""); setModal({ fila: d }); }}>✏️</button></td>
                          {campos.map((c) => <td key={c.n} className={c.t === "numero" ? "num" : ""}>{celda(c, d[c.n])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {modal && (
        <Modal titulo={modal.fila ? "✏️ Editar registro" : "➕ Nuevo registro"} onClose={() => setModal(null)}>
          <Formulario campos={campos} inicial={modal.fila} onGuardar={guardar} onCancelar={() => setModal(null)} guardando={guardando} error={errForm} />
        </Modal>
      )}
    </div>
  );
}
