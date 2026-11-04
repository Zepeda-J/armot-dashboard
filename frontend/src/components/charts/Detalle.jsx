import { entero } from "../../lib/resumen";

function Barra({ valor, max }) {
  return (
    <div className="pbar">
      <span style={{ width: `${max ? (valor / max) * 100 : 0}%` }} />
      <b>{entero(valor)}</b>
    </div>
  );
}

export default function Detalle({ datos, alto }) {
  const { titulo, filas } = datos;
  if (!filas.length) return <div className="aviso">No hay columnas para armar el detalle.</div>;
  const mx = (k) => Math.max(1, ...filas.map((f) => f[k]));
  return (
    <div className="tbl-wrap" style={{ "--alto": `${alto}px` }}>
      <table className="tbl">
        <thead>
          <tr><th>{titulo}</th><th>Contratos</th><th>Unidades</th><th>Operarios</th></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre}>
              <td>{f.nombre}</td>
              <td><Barra valor={f.contratos} max={mx("contratos")} /></td>
              <td><Barra valor={f.unidades} max={mx("unidades")} /></td>
              <td><Barra valor={f.operarios} max={mx("operarios")} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
