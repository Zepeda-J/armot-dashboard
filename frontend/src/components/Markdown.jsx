// Renderizador mínimo de Markdown para las respuestas de la IA (sin dependencias).
// Soporta: encabezados (#), listas con viñetas y numeradas, tablas con |, **negritas**, *cursiva* y `código`.
import { Fragment } from "react";

function inline(texto, clave) {
  return String(texto)
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g)
    .map((p, i) => {
      const k = `${clave}-${i}`;
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>;
      if (/^`[^`]+`$/.test(p)) return <code key={k}>{p.slice(1, -1)}</code>;
      if (/^\*[^*\s][^*]*\*$/.test(p)) return <em key={k}>{p.slice(1, -1)}</em>;
      return <Fragment key={k}>{p}</Fragment>;
    });
}

const esFilaTabla = (l) => /^\s*\|.*\|\s*$/.test(l);
const esSeparador = (l) => /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes("-");
const celdas = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function Markdown({ texto }) {
  const lineas = String(texto || "").replace(/\r/g, "").split("\n");
  const bloques = [];
  let i = 0;

  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }

    if (esFilaTabla(l) && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      const cab = celdas(l);
      const filas = [];
      i += 2;
      while (i < lineas.length && esFilaTabla(lineas[i])) filas.push(celdas(lineas[i++]));
      bloques.push({ t: "tabla", cab, filas });
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { bloques.push({ t: "h", texto: h[2] }); i++; continue; }

    if (/^\s*([-*•])\s+/.test(l)) {
      const items = [];
      while (i < lineas.length && /^\s*([-*•])\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*([-*•])\s+/, ""));
      bloques.push({ t: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items = [];
      while (i < lineas.length && /^\s*\d+[.)]\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*\d+[.)]\s+/, ""));
      bloques.push({ t: "ol", items });
      continue;
    }
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,4}\s|\s*([-*•]|\d+[.)])\s+)/.test(lineas[i]) && !esFilaTabla(lineas[i])) parrafo.push(lineas[i++]);
    if (!parrafo.length) { parrafo.push(lineas[i++]); }
    bloques.push({ t: "p", texto: parrafo.join(" ") });
  }

  return (
    <div className="md">
      {bloques.map((b, n) => {
        if (b.t === "h") return <h4 key={n}>{inline(b.texto, n)}</h4>;
        if (b.t === "ul") return <ul key={n}>{b.items.map((it, j) => <li key={j}>{inline(it, `${n}-${j}`)}</li>)}</ul>;
        if (b.t === "ol") return <ol key={n}>{b.items.map((it, j) => <li key={j}>{inline(it, `${n}-${j}`)}</li>)}</ol>;
        if (b.t === "tabla")
          return (
            <div className="tbl-wrap" key={n} style={{ "--alto": "320px" }}>
              <table className="tbl">
                <thead><tr>{b.cab.map((c, j) => <th key={j}>{inline(c, `${n}h${j}`)}</th>)}</tr></thead>
                <tbody>{b.filas.map((f, r) => <tr key={r}>{f.map((c, j) => <td key={j}>{inline(c, `${n}-${r}-${j}`)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        return <p key={n}>{inline(b.texto, n)}</p>;
      })}
    </div>
  );
}
