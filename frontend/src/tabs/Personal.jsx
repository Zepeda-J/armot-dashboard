import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Banner from "../components/Banner";
import Kpis from "../components/Kpis";
import Modal from "../components/Modal";
import { descargarCSV, pct } from "../lib/formato";

const ESTADOS = ["Activo", "Pendiente", "Inactivo"];
const NIVELES = ["Nivel 1 (Coordinador)", "Nivel 2 (Gerente)", "Nivel 3 (Administrativo)", "Nivel 4 (Director)"];
const PUESTOS_COORD = ["Coordinador", "Coordinadora", "Gerente", "Administrativo"];
const REGIONES = ["CDMX", "Toluca", "Estado de México", "Foraneos"];
const AREAS = ["Licitaciones", "Operaciones", "Auditoria", "Finanzas", "Nomina", "Movimiento de Personal", "Recursos Humanos", "Almacen", "Juridico", "Planeación y Desarrollo"];
const ICONOS_AREA = {
  Licitaciones: "📜", Operaciones: "🛠️", Auditoria: "🔍", Finanzas: "💰", Nomina: "🧾", "Movimiento de Personal": "🔁",
  "Recursos Humanos": "🧑‍🤝‍🧑", Almacen: "📦", Juridico: "⚖️", "Planeación y Desarrollo": "🧭",
};
const ICONOS_REGION = { CDMX: "🏙️", Toluca: "⛰️", "Estado de México": "🗺️", Foraneos: "🧭" };

const CONFIG = {
  coordinadores: {
    icono: "🪪", titulo: "Coordinadores", subtitulo: "Credenciales del personal operativo por zona: busca, filtra y gestiona en un clic",
    grupos: REGIONES, iconos: ICONOS_REGION, etiquetaGrupo: "Zona", prefijo: "USR", etiquetaNuevo: "➕ Nueva", unidad: "credenciales",
  },
  administracion: {
    icono: "💼", titulo: "Administración", subtitulo: "Credenciales del personal administrativo por área",
    grupos: AREAS, iconos: ICONOS_AREA, etiquetaGrupo: "Área", prefijo: "ADM", etiquetaNuevo: "➕ Nuevo", unidad: "personas",
  },
};

const iniciales = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const colorDe = (t) => `hsl(${[...String(t)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 45%)`;
const waLink = (tel) => { const d = String(tel || "").replace(/\D/g, ""); return d.length >= 10 ? `https://wa.me/${d.length === 10 ? "52" + d : d}` : null; };

function Foto({ ruta, persona }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let vivo = true, obj = null;
    setUrl(null);
    if (persona.tieneFoto) {
      api.fotoPersona(ruta, persona.id).then((b) => {
        if (vivo && b) { obj = URL.createObjectURL(b); setUrl(obj); }
      });
    }
    return () => { vivo = false; if (obj) URL.revokeObjectURL(obj); };
  }, [ruta, persona.id, persona.tieneFoto, persona.fotoHash]);
  if (url) return <img className="avatar" src={url} alt={persona.nombre} />;
  return <div className="avatar" style={{ background: colorDe(persona.nombre) }} aria-label={persona.nombre}>{iniciales(persona.nombre)}</div>;
}

function aBase64(archivo) {
  return new Promise((ok, fallo) => {
    if (archivo.size > 3 * 1024 * 1024) return fallo(new Error("La foto pesa más de 3 MB."));
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => fallo(new Error("No se pudo leer la foto."));
    r.readAsDataURL(archivo);
  });
}

function FormPersona({ clave, cfg, persona, personas, onGuardar, onCancelar, guardando, error }) {
  const nuevo = !persona;
  const siguienteId = useMemo(() => {
    const nums = personas.map((p) => (String(p.id).match(/(\d+)$/) || [])[1]).filter(Boolean).map(Number);
    return `${cfg.prefijo}-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
  }, [personas, cfg.prefijo]);
  const [v, setV] = useState({
    id: siguienteId,
    nombre: persona?.nombre || "",
    puesto: persona?.puesto || (clave === "coordinadores" ? PUESTOS_COORD[0] : ""),
    departamento: persona?.departamento || cfg.grupos[0],
    estado: persona?.estado || "Activo",
    motivo: "",
    email: persona?.email || "",
    telefono: persona?.telefono || "",
    nivel_acceso: persona?.nivel_acceso || (nuevo ? NIVELES[0] : ""),
  });
  const [foto, setFoto] = useState(null);
  const [errLocal, setErrLocal] = useState("");
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const grupos = cfg.grupos.includes(v.departamento) ? cfg.grupos : [v.departamento, ...cfg.grupos];

  async function enviar() {
    setErrLocal("");
    try {
      const fotoBase64 = foto ? await aBase64(foto) : undefined;
      onGuardar({ ...v, fotoBase64, ...(nuevo && clave === "administracion" ? { id: undefined } : {}) });
    } catch (e) {
      setErrLocal(e.message);
    }
  }
  const cambioEstado = !nuevo && persona.estado !== v.estado && [persona.estado, v.estado].includes("Inactivo");

  return (
    <div className="form-modal">
      <div className="form-grid">
        <label className="field"><span className="field-label">Nombre completo *</span>
          <input className="input" value={v.nombre} onChange={(e) => set("nombre", e.target.value)} /></label>
        {nuevo && clave === "coordinadores" ? (
          <label className="field"><span className="field-label">ID de usuario *</span>
            <input className="input" value={v.id} onChange={(e) => set("id", e.target.value)} /></label>
        ) : <span />}
        <label className="field"><span className="field-label">Puesto / Cargo{clave === "administracion" ? " *" : ""}</span>
          {nuevo && clave === "coordinadores" ? (
            <select className="select" value={v.puesto} onChange={(e) => set("puesto", e.target.value)}>{PUESTOS_COORD.map((p) => <option key={p}>{p}</option>)}</select>
          ) : <input className="input" value={v.puesto} onChange={(e) => set("puesto", e.target.value)} />}
        </label>
        <label className="field"><span className="field-label">{cfg.etiquetaGrupo}</span>
          <select className="select" value={v.departamento} onChange={(e) => set("departamento", e.target.value)}>{grupos.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="field"><span className="field-label">Estado</span>
          <select className="select" value={v.estado} onChange={(e) => set("estado", e.target.value)}>{ESTADOS.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="field"><span className="field-label">Nivel de acceso</span>
          {nuevo ? <select className="select" value={v.nivel_acceso} onChange={(e) => set("nivel_acceso", e.target.value)}>{NIVELES.map((g) => <option key={g}>{g}</option>)}</select>
            : <input className="input" value={v.nivel_acceso} onChange={(e) => set("nivel_acceso", e.target.value)} />}</label>
        <label className="field"><span className="field-label">Correo electrónico</span>
          <input className="input" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="field"><span className="field-label">Teléfono</span>
          <input className="input" value={v.telefono} onChange={(e) => set("telefono", e.target.value)} /></label>
        {!nuevo && (
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label">Motivo del cambio de estado (opcional){cambioEstado ? " · se guardará en el histórico laboral" : ""}</span>
            <input className="input" value={v.motivo} onChange={(e) => set("motivo", e.target.value)} /></label>
        )}
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field-label">{nuevo ? "Foto de perfil" : "Reemplazar foto (opcional)"} · JPG o PNG, máx. 3 MB</span>
          <input className="input" type="file" accept="image/png,image/jpeg" onChange={(e) => setFoto(e.target.files?.[0] || null)} /></label>
      </div>
      {(error || errLocal) && <div className="error-msg">{errLocal || error}</div>}
      <div className="form-actions">
        <button className="btn" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button className="btn btn-primary" onClick={enviar} disabled={guardando}>{guardando ? "Guardando…" : "💾 Guardar"}</button>
      </div>
    </div>
  );
}

function Tarjeta({ ruta, p, soloLectura, onEditar, onEliminar }) {
  const wa = waLink(p.telefono);
  return (
    <div className="pcard">
      <div className="pcard-top">
        <span className="id-tag">🪪 {p.id}</span>
        <span className={`badge badge-${(p.estado || "").toLowerCase()}`}>{p.estado}</span>
      </div>
      <div className="pcard-body">
        <Foto ruta={ruta} persona={p} />
        <div style={{ minWidth: 0 }}>
          <div className="pcard-nombre">{p.nombre}</div>
          <div className="pcard-linea">💼 {p.puesto || "—"}</div>
          <div className="pcard-linea">🏢 <code>{p.departamento || "—"}</code></div>
        </div>
      </div>
      <div className="pcard-datos">
        <div>✉️ {p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : "—"}</div>
        <div>📞 {wa ? <a href={wa} target="_blank" rel="noreferrer">{p.telefono}</a> : p.telefono || "—"}</div>
        <div>🔑 {p.nivel_acceso || "—"}</div>
        <div>📅 Ingreso: {p.fecha_ingreso || "—"}</div>
      </div>
      {!soloLectura && (
        <div className="pcard-acciones">
          <button className="btn" onClick={() => onEditar(p)}>✏️ Editar</button>
          <button className="btn" style={{ color: "var(--red)" }} onClick={() => onEliminar(p)}>🗑️ Eliminar</button>
        </div>
      )}
    </div>
  );
}

export default function Personal({ clave, soloLectura }) {
  const cfg = CONFIG[clave];
  const [estado, setEstado] = useState({ cargando: true, error: "", personas: [] });
  const [historial, setHistorial] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [vista, setVista] = useState("tarjetas");
  const [grupo, setGrupo] = useState("Todas");
  const [modal, setModal] = useState(null); // { persona | null }
  const [guardando, setGuardando] = useState(false);
  const [errForm, setErrForm] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    Promise.all([api.personal(clave), api.historialPersonal(clave)])
      .then(([p, h]) => { setEstado({ cargando: false, error: "", personas: p.personas }); setHistorial(h.historial); })
      .catch((e) => setEstado((s) => ({ ...s, cargando: false, error: e.message })));
  }, [clave]);

  useEffect(() => {
    setEstado({ cargando: true, error: "", personas: [] });
    setBusqueda(""); setFiltro("Todos"); setGrupo("Todas"); setVista("tarjetas");
    cargar();
  }, [cargar]);

  const personas = estado.personas;
  const conteo = useMemo(() => ({
    Todos: personas.length,
    ...Object.fromEntries(ESTADOS.map((e) => [e, personas.filter((p) => p.estado === e).length])),
  }), [personas]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return personas.filter((p) => {
      if (filtro !== "Todos" && p.estado !== filtro) return false;
      if (!q) return true;
      return [p.id, p.nombre, p.puesto, p.departamento, p.email, p.telefono].join(" ").toLowerCase().includes(q);
    });
  }, [personas, busqueda, filtro]);

  const kpis = useMemo(() => {
    const total = conteo.Todos;
    const cuenta = (...claves) => personas.filter((p) => claves.some((k) => (p.puesto || "").toLowerCase().includes(k))).length;
    const ultimo = clave === "coordinadores"
      ? { etiqueta: "Servicios asignados", icono: "🧰", color: "#0d9488", valor: personas.reduce((s, p) => s + (Array.isArray(p.servicios) ? p.servicios.reduce((a, x) => a + (parseInt(x["Cantidad real"], 10) || 0), 0) : 0), 0).toLocaleString("es-MX"), detalle: "cantidad real en total", porcentaje: null }
      : { etiqueta: "Áreas", icono: "🏢", color: "#0d9488", valor: String(new Set(personas.map((p) => p.departamento).filter(Boolean)).size), detalle: `con personal de ${AREAS.length} áreas`, porcentaje: null };
    return [
      { etiqueta: clave === "coordinadores" ? "Credenciales" : "Personal", icono: clave === "coordinadores" ? "🪪" : "💼", color: "#2563eb", valor: String(total),
        detalle: clave === "coordinadores" ? `${cuenta("coordinador")} coordinadores · ${cuenta("gerente")} gerentes` : "personas registradas", porcentaje: null },
      { etiqueta: "Activos", icono: "✅", color: "#16a34a", valor: String(conteo.Activo), detalle: `${pct(conteo.Activo, total).toFixed(0)}% del total`, porcentaje: pct(conteo.Activo, total) },
      { etiqueta: "Pendientes", icono: "⏳", color: "#f59e0b", valor: String(conteo.Pendiente), detalle: "por activar", porcentaje: pct(conteo.Pendiente, total) },
      { etiqueta: "Inactivos", icono: "⛔", color: "#ef4444", valor: String(conteo.Inactivo), detalle: "sin acceso", porcentaje: pct(conteo.Inactivo, total) },
      ultimo,
    ];
  }, [personas, conteo, clave]);

  async function guardar(valores) {
    setGuardando(true); setErrForm("");
    try {
      if (modal.persona) await api.editarPersona(clave, modal.persona.id, valores);
      else await api.crearPersona(clave, valores);
      setModal(null);
      setAviso(modal.persona ? "Credencial actualizada." : "Credencial agregada.");
      cargar();
    } catch (e) {
      setErrForm(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar la credencial de ${p.nombre} (${p.id})? Esta acción no se puede deshacer.\n\nSi solo dejó de laborar, mejor cámbiala a "Inactivo" para conservar el histórico.`)) return;
    try {
      await api.eliminarPersona(clave, p.id);
      setAviso("Credencial eliminada.");
      cargar();
    } catch (e) {
      setAviso(e.message);
    }
  }

  const columnasCsv = ["id", "nombre", "puesto", "departamento", "estado", "email", "telefono", "nivel_acceso", "fecha_ingreso"];
  const gruposVisibles = grupo === "Todas" ? cfg.grupos : [grupo];
  const extra = [...new Set(filtradas.map((p) => p.departamento).filter((d) => d && !cfg.grupos.includes(d)))];
  const histFiltrado = historial.filter((h) => grupo === "Todas" || h.departamento === grupo)
    .filter((h) => !busqueda.trim() || [h.nombre, h.id, h.puesto, h.motivo].join(" ").toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Banner icono={cfg.icono} titulo={cfg.titulo} subtitulo={cfg.subtitulo}
        pills={[`👥 ${personas.length} ${cfg.unidad}`, `🗓️ ${new Date().toLocaleDateString("es-MX")}`, ...(soloLectura ? ["👁️ Solo lectura"] : []), "☁️ Supabase"]} />

      {estado.cargando && <div className="aviso">Cargando información…</div>}
      {estado.error && <div className="aviso" style={{ color: "var(--red)" }}>{estado.error}</div>}

      {!estado.cargando && !estado.error && (
        <>
          <Kpis items={kpis} />

          <div className="toolbar">
            <input className="input" style={{ maxWidth: 280 }} placeholder="🔎 Buscar por nombre, puesto, ID, correo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            {vista !== "historico" && (
              <div className="seg">
                {["Todos", ...ESTADOS].map((e) => <button key={e} className={filtro === e ? "on" : ""} onClick={() => setFiltro(e)}>{e} ({conteo[e]})</button>)}
              </div>
            )}
            <div className="seg">
              {[["tarjetas", "🪪 Tarjetas"], ["tabla", "📋 Tabla"], ["historico", "🕘 Histórico"]].map(([k, t]) => (
                <button key={k} className={vista === k ? "on" : ""} onClick={() => setVista(k)}>{t}</button>
              ))}
            </div>
            <span className="toolbar-sp" />
            {!soloLectura && <button className="btn btn-primary" onClick={() => { setErrForm(""); setModal({ persona: null }); }}>{cfg.etiquetaNuevo}</button>}
          </div>
          {aviso && <div className="nota" onClick={() => setAviso("")}>{aviso} <span style={{ opacity: 0.6 }}>(clic para cerrar)</span></div>}

          <div className="seg" style={{ justifySelf: "start" }}>
            {["Todas", ...cfg.grupos].map((g) => <button key={g} className={grupo === g ? "on" : ""} onClick={() => setGrupo(g)}>{g === "Todas" ? "Todas" : `${cfg.iconos[g] || ""} ${g}`}</button>)}
          </div>

          {vista === "tarjetas" && (
            filtradas.length === 0 ? <div className="aviso">Sin resultados. Prueba otra búsqueda o elige "Todos" en el estado.</div> : (
              <>
                <div className="resumen-txt">Mostrando <b>{filtradas.length}</b> de <b>{personas.length}</b> {cfg.unidad}.</div>
                {[...gruposVisibles, ...(grupo === "Todas" ? extra : [])].map((g) => {
                  const lista = filtradas.filter((p) => p.departamento === g);
                  if (!lista.length) return null;
                  return (
                    <section key={g}>
                      <div className="grupo">{cfg.iconos[g] || "📍"} {g} <span>{lista.length}</span></div>
                      <div className="cards">
                        {lista.map((p) => <Tarjeta key={p.id} ruta={clave} p={p} soloLectura={soloLectura} onEditar={(x) => { setErrForm(""); setModal({ persona: x }); }} onEliminar={eliminar} />)}
                      </div>
                    </section>
                  );
                })}
              </>
            )
          )}

          {vista === "tabla" && (() => {
            const lista = filtradas.filter((p) => grupo === "Todas" || p.departamento === grupo);
            return (
              <>
                <div className="resumen-txt">
                  {lista.length} de {personas.length} {cfg.unidad}
                  <button className="btn" style={{ marginLeft: 12 }} onClick={() => descargarCSV(`${clave}.csv`, columnasCsv, lista)} disabled={!lista.length}>⬇️ Descargar CSV</button>
                </div>
                <div className="tbl-wrap" style={{ "--alto": "560px" }}>
                  <table className="tbl">
                    <thead><tr>{columnasCsv.map((c) => <th key={c}>{c.replace("_", " ")}</th>)}</tr></thead>
                    <tbody>{lista.map((p) => <tr key={p.id}>{columnasCsv.map((c) => <td key={c}>{p[c] || "—"}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </>
            );
          })()}

          {vista === "historico" && (
            <>
              <div className="resumen-txt">
                {histFiltrado.length} movimiento(s) · bajas y reactivaciones
                <button className="btn" style={{ marginLeft: 12 }} disabled={!histFiltrado.length}
                  onClick={() => descargarCSV(`historial_laboral_${clave}.csv`, ["fecha", "id", "nombre", "puesto", "departamento", "evento", "estado_anterior", "estado_nuevo", "fecha_ingreso", "antiguedad", "motivo", "registrado_por"], histFiltrado)}>⬇️ Descargar CSV</button>
              </div>
              {histFiltrado.length === 0 ? <div className="aviso">Aún no hay bajas ni reactivaciones registradas.</div> : (
                <div className="tbl-wrap" style={{ "--alto": "560px" }}>
                  <table className="tbl">
                    <thead><tr><th>Fecha</th><th>ID</th><th>Nombre</th><th>Puesto</th><th>{cfg.etiquetaGrupo}</th><th>Evento</th><th>Ingreso</th><th>Antigüedad</th><th>Motivo</th><th>Registró</th></tr></thead>
                    <tbody>
                      {[...histFiltrado].reverse().map((h, i) => (
                        <tr key={i}>
                          <td>{h.fecha}</td><td>{h.id}</td><td>{h.nombre}</td><td>{h.puesto}</td><td>{h.departamento}</td>
                          <td><span className={`badge badge-${h.evento === "Baja" ? "inactivo" : "activo"}`}>{h.evento}</span></td>
                          <td>{h.fecha_ingreso}</td><td>{h.antiguedad}</td><td>{h.motivo || "—"}</td><td>{h.registrado_por}</td>
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
        <Modal titulo={modal.persona ? "✏️ Editar credencial" : "➕ Nueva credencial"} onClose={() => setModal(null)}>
          <FormPersona clave={clave} cfg={cfg} persona={modal.persona} personas={personas} onGuardar={guardar} onCancelar={() => setModal(null)} guardando={guardando} error={errForm} />
        </Modal>
      )}
    </div>
  );
}
