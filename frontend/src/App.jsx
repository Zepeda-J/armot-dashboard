import { useState } from "react";
import Login from "./pages/Login";
import AIAssistant from "./components/AIAssistant";
import ResumenGlobal from "./tabs/ResumenGlobal";
import Contratos from "./tabs/Contratos";
import Personal from "./tabs/Personal";
import Tablero from "./tabs/Tablero";
import { obtenerSesion, cerrarSesion } from "./api";
import { aplicarTema, temaInicial } from "./lib/tema";
import "./styles-extra.css";

// Pestañas por rol: "personal" solo ve Coordinadores y Administración (igual que PESTANAS_POR_ROL en Streamlit).
const TODAS = [
  { id: "resumen", etiqueta: "Resumen Global" },
  { id: "contratos", etiqueta: "Contratos" },
  { id: "coordinadores", etiqueta: "Coordinadores" },
  { id: "administracion", etiqueta: "Administración" },
  { id: "facturacion", etiqueta: "Seguimiento de facturación" },
  { id: "acuerdos", etiqueta: "Acuerdos" },
];
const PESTANAS_POR_ROL = { personal: ["coordinadores", "administracion"] };

export default function App() {
  const [sesion, setSesion] = useState(obtenerSesion());
  const [tema, setTema] = useState(temaInicial());
  const [lateral, setLateral] = useState(true);
  const [activa, setActiva] = useState(null);

  if (!sesion) return <Login onLogin={setSesion} />;

  const visibles = PESTANAS_POR_ROL[sesion.rol] ? TODAS.filter((t) => PESTANAS_POR_ROL[sesion.rol].includes(t.id)) : TODAS;
  const actual = activa && visibles.some((t) => t.id === activa) ? activa : visibles[0].id;
  const soloLectura = sesion.rol === "personal";
  const puedeVerTodo = !PESTANAS_POR_ROL[sesion.rol];

  function alternarTema() {
    const siguiente = tema === "dark" ? "light" : "dark";
    aplicarTema(siguiente);
    setTema(siguiente);
  }

  return (
    <div className="app">
      <aside className={`sidebar ${lateral ? "" : "closed"}`}>
        <div className="brand"><span className="brand-logo">📊</span>Armot · Dashboard</div>
        <div className="user-box">
          <span>👤 Usuario: <b>{sesion.usuario}</b></span>
          <span>🪪 Rol: <b>{sesion.rol?.toUpperCase()}</b></span>
        </div>
        {puedeVerTodo && <AIAssistant />}
        <div className="side-actions">
          <button className="btn btn-block" onClick={alternarTema}>{tema === "dark" ? "☀️ Tema claro" : "🌙 Tema oscuro"}</button>
          <button className="btn btn-block" onClick={() => { cerrarSesion(); setSesion(null); }}>🚪 Cerrar sesión</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button className="btn btn-icon" onClick={() => setLateral((v) => !v)} aria-label="Mostrar u ocultar panel lateral">☰</button>
          <h1 className="app-title">Corporativo de Limpieza</h1>
          <span style={{ width: 38 }} />
        </div>

        <nav className="tabs" role="tablist">
          {visibles.map((t) => (
            <button key={t.id} role="tab" aria-selected={actual === t.id} className={`tab ${actual === t.id ? "on" : ""}`} onClick={() => setActiva(t.id)}>
              {t.etiqueta}
            </button>
          ))}
        </nav>

        {actual === "resumen" && <ResumenGlobal />}
        {actual === "contratos" && <Contratos />}
        {actual === "coordinadores" && <Personal clave="coordinadores" soloLectura={soloLectura} />}
        {actual === "administracion" && <Personal clave="administracion" soloLectura={soloLectura} />}
        {actual === "facturacion" && <Tablero clave="facturacion" />}
        {actual === "acuerdos" && <Tablero clave="acuerdos" />}
      </main>
    </div>
  );
}
