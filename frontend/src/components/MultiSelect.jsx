import { useEffect, useRef, useState } from "react";

export default function MultiSelect({ etiqueta, opciones, seleccion, onChange, vacio = "Todos" }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function cerrar(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  function alternar(valor) {
    onChange(seleccion.includes(valor) ? seleccion.filter((v) => v !== valor) : [...seleccion, valor]);
  }

  const texto = seleccion.length === 0 ? vacio : seleccion.length <= 2 ? seleccion.join(", ") : `${seleccion.length} seleccionados`;

  return (
    <div className="field ms" ref={ref}>
      <span className="field-label">{etiqueta}</span>
      <button type="button" className={`ms-btn ${seleccion.length ? "has" : ""}`} onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        <span className={seleccion.length ? "" : "ph"}>{texto}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div className="ms-pop" role="listbox">
          {opciones.length === 0 && <div className="ms-empty">Sin opciones</div>}
          {opciones.map((o) => (
            <label key={o} className="ms-opt">
              <input type="checkbox" checked={seleccion.includes(o)} onChange={() => alternar(o)} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
