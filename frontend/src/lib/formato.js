export const moneda = (v) =>
  Number(v || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

export const pct = (parte, total) => (total ? (parte / total) * 100 : 0);

export function fechaMx(iso) {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

export function hoyISO() {
  return new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD en hora local
}

export function sumarDiasISO(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("sv-SE");
}

// ---- CSV (se abre directo en Excel; el BOM conserva los acentos) ----
export function aCSV(columnas, filas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columnas.join(","), ...filas.map((f) => columnas.map((c) => esc(f[c])).join(","))].join("\r\n");
}

export function descargarCSV(nombre, columnas, filas) {
  const blob = new Blob(["\ufeff" + aCSV(columnas, filas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function leerCSV(texto) {
  const t = texto.replace(/^\ufeff/, "");
  const sep = (t.split("\n")[0].match(/;/g) || []).length > (t.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila); }
  if (!filas.length) return [];
  const [encabezado, ...datos] = filas;
  return datos.map((f) => Object.fromEntries(encabezado.map((h, i) => [h.trim(), f[i] ?? ""])));
}
