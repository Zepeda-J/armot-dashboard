// Cálculos del tablero "Resumen Global" (equivalentes a las funciones _preparar_datos,
// _calcular_kpis, _calcular_insights y fig_* del Streamlit original).

export const PERIODO_FISCAL_INICIAL = 2026; // periodo que se muestra al abrir el tablero
export const DIAS_POR_VENCER = 90;
export const TOP_BARRAS_COMPACTO = 8;

export const PALETA = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#ec4899", "#64748b", "#a16207"];
export const COLOR_ESTATUS = { Vigente: "#10b981", "Por vencer": "#f59e0b", Vencido: "#ef4444", "Sin fecha": "#94a3b8" };
export const ORDEN_ESTATUS = ["Vigente", "Por vencer", "Vencido", "Sin fecha"];

export const DIMENSIONES = { Dependencia: "dependencia", Estado: "estado", Empresa: "empresa" };
export const METRICAS = { "Monto máx. c/IVA": "monto_max_con_iva", Unidades: "unidades", "Operarios máx.": "operarios_max" };
export const VISTAS = ["Composición", "Vigencia", "Dispersión", "Detalle"];

export const esMonto = (nombre) => nombre.startsWith("Monto");
const VACIOS = ["", "nan", "none", "<na>", "null", "undefined"];
export const esVacio = (v) => v == null || VACIOS.includes(String(v).trim().toLowerCase());
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const suma = (rows, clave) => rows.reduce((a, r) => a + num(r[clave]), 0);
const unicos = (rows, clave) => new Set(rows.filter((r) => !esVacio(r[clave])).map((r) => String(r[clave]).trim())).size;

// ---------- Formatos ----------
export function mdp(valor) {
  if (Math.abs(valor) >= 1e9) return `$${(valor / 1e9).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mil M`;
  return `$${(valor / 1e6).toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
}
export const moneda = (v) => `$${num(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const entero = (v) => Math.round(num(v)).toLocaleString("es-MX");
export const pct = (parte, total) => (total ? (parte / total) * 100 : 0);
export function fmtValor(metNombre, v) {
  return esMonto(metNombre) ? `$${v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M` : entero(v);
}

// ---------- Fechas ----------
export function parseFecha(v) {
  if (esVacio(v)) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // día/mes/año (formato mexicano)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
export const hoy = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
export const fmtFecha = (d) => (d ? d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

export function estatusVigencia(fin, ref = hoy()) {
  if (!fin) return "Sin fecha";
  if (fin < ref) return "Vencido";
  const limite = new Date(ref);
  limite.setDate(limite.getDate() + DIAS_POR_VENCER);
  return fin <= limite ? "Por vencer" : "Vigente";
}

// ---------- Periodo fiscal ----------
const usaEjercicio = (rows) => rows.some((r) => Number.isFinite(parseInt(r.ejercicio_fiscal, 10)));

export function aniosDisponibles(rows) {
  if (!rows.length) return [];
  if (usaEjercicio(rows)) {
    return [...new Set(rows.map((r) => parseInt(r.ejercicio_fiscal, 10)).filter(Number.isFinite))].sort((a, b) => a - b);
  }
  const ini = rows.map((r) => parseFecha(r.fecha_inicio)).filter(Boolean);
  const fin = rows.map((r) => parseFecha(r.fecha_termino)).filter(Boolean);
  if (!ini.length || !fin.length) return [];
  const a = Math.min(...ini.map((d) => d.getFullYear()));
  const b = Math.max(...fin.map((d) => d.getFullYear()));
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function filtrarPeriodo(rows, anio) {
  if (anio === "Todos") return rows;
  const y = Number(anio);
  if (usaEjercicio(rows)) return rows.filter((r) => parseInt(r.ejercicio_fiscal, 10) === y);
  return rows.filter((r) => {
    const i = parseFecha(r.fecha_inicio);
    const f = parseFecha(r.fecha_termino);
    return i && f && i.getFullYear() <= y && f.getFullYear() >= y;
  });
}

// ---------- KPIs e insights ----------
export function calcularKpis(rows) {
  return {
    entidades: unicos(rows, "dependencia"),
    estados: unicos(rows, "estado"),
    unidades: Math.round(suma(rows, "unidades")),
    contratos: unicos(rows, "no_contrato"),
    op_min: Math.round(suma(rows, "operarios_min")),
    op_max: Math.round(suma(rows, "operarios_max")),
    min_sin: suma(rows, "monto_min_sin_iva"),
    max_sin: suma(rows, "monto_max_sin_iva"),
    min_con: suma(rows, "monto_min_con_iva"),
    max_con: suma(rows, "monto_max_con_iva"),
    filas: rows.length,
  };
}

export function ranking(rows, dimKey, metKey) {
  const mapa = new Map();
  for (const r of rows) {
    if (esVacio(r[dimKey])) continue;
    const k = String(r[dimKey]).trim();
    mapa.set(k, (mapa.get(k) || 0) + num(r[metKey]));
  }
  return [...mapa.entries()].map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor);
}

export function calcularInsights(rows) {
  const ins = { dep: null, est: null, top3: null, vig: null };
  const m = ranking(rows, "dependencia", "monto_max_con_iva");
  const totalM = m.reduce((a, x) => a + x.valor, 0);
  if (m.length && totalM > 0) {
    ins.dep = { nombre: m[0].nombre, monto: m[0].valor, pct: (m[0].valor / totalM) * 100 };
    const n = Math.min(3, m.length);
    ins.top3 = { pct: (m.slice(0, n).reduce((a, x) => a + x.valor, 0) / totalM) * 100, n };
  }
  const e = ranking(rows, "estado", "monto_max_con_iva");
  const totalE = e.reduce((a, x) => a + x.valor, 0);
  if (e.length && totalE > 0) ins.est = { nombre: e[0].nombre, monto: e[0].valor, pct: (e[0].valor / totalE) * 100 };

  if (rows.length) {
    // Un contrato puede tener varias filas: se cuenta una vez con su fecha de término más tardía.
    const porContrato = new Map();
    rows.forEach((r, i) => {
      const k = esVacio(r.no_contrato) ? `fila-${i}` : String(r.no_contrato).trim();
      const f = parseFecha(r.fecha_termino);
      const previo = porContrato.get(k);
      porContrato.set(k, !previo || (f && f > previo) ? f || previo || null : previo);
    });
    const conteo = { Vigente: 0, "Por vencer": 0, Vencido: 0, "Sin fecha": 0 };
    const ref = hoy();
    for (const f of porContrato.values()) conteo[estatusVigencia(f, ref)] += 1;
    ins.vig = conteo;
  }
  return ins;
}

// ---------- Vistas ----------
/** Top N y el resto agrupado en "Otros (k)"; el elemento enfocado siempre se conserva. */
export function topConOtros(datos, foco, n = TOP_BARRAS_COMPACTO) {
  if (datos.length <= n) return datos;
  let cab = datos.slice(0, n - 1);
  if (foco !== "Todos" && !cab.some((d) => d.nombre === foco) && datos.some((d) => d.nombre === foco)) {
    cab = [...cab.slice(0, n - 2), datos.find((d) => d.nombre === foco)];
  }
  const resto = datos.filter((d) => !cab.includes(d));
  return [...cab, { nombre: `Otros (${resto.length})`, valor: resto.reduce((a, x) => a + x.valor, 0) }];
}

export function detalle(rows, dimNombre) {
  const gKey = dimNombre === "Estado" ? "dependencia" : "estado";
  const grupos = new Map();
  for (const r of rows) {
    if (esVacio(r[gKey])) continue;
    const k = String(r[gKey]).trim();
    const g = grupos.get(k) || { nombre: k, contratos: new Set(), unidades: 0, operarios: 0 };
    if (!esVacio(r.no_contrato)) g.contratos.add(String(r.no_contrato).trim());
    g.unidades += num(r.unidades);
    g.operarios += num(r.operarios_max);
    grupos.set(k, g);
  }
  const filas = [...grupos.values()]
    .map((g) => ({ nombre: g.nombre, contratos: g.contratos.size, unidades: Math.round(g.unidades), operarios: Math.round(g.operarios) }))
    .sort((a, b) => b.unidades - a.unidades);
  return { titulo: gKey === "estado" ? "Estado" : "Dependencia", filas };
}

export function composicion(rows, dimKey, metKey, metNombre) {
  const sec = dimKey === "dependencia" ? "estado" : "dependencia";
  const usaSec = sec !== dimKey && rows.some((r) => !esVacio(r[sec]));
  const esc = esMonto(metNombre) ? 1e6 : 1;
  const grupos = new Map();
  for (const r of rows) {
    if (esVacio(r[dimKey])) continue;
    const valor = num(r[metKey]) / esc;
    if (valor <= 0) continue;
    const a = String(r[dimKey]).trim();
    const b = usaSec && !esVacio(r[sec]) ? String(r[sec]).trim() : "—";
    const g = grupos.get(a) || new Map();
    g.set(b, (g.get(b) || 0) + valor);
    grupos.set(a, g);
  }
  return [...grupos.entries()]
    .map(([name, hijos]) => ({ name, children: [...hijos.entries()].map(([n, size]) => ({ name: n, size })) }))
    .sort((x, y) => y.children.reduce((s, c) => s + c.size, 0) - x.children.reduce((s, c) => s + c.size, 0));
}

export function dispersion(rows) {
  const mapa = new Map();
  for (const r of rows) {
    if (esVacio(r.dependencia)) continue;
    const k = String(r.dependencia).trim();
    const g = mapa.get(k) || { nombre: k, unidades: 0, monto: 0, operarios: 0 };
    g.unidades += num(r.unidades);
    g.monto += num(r.monto_max_con_iva) / 1e6;
    g.operarios += num(r.operarios_max);
    mapa.set(k, g);
  }
  return [...mapa.values()].map((g) => ({ ...g, unidades: Math.round(g.unidades), operarios: Math.max(1, Math.round(g.operarios)) }));
}

/** Gantt de vigencia: una barra por dependencia (compacto) o por contrato (ampliado). */
export function vigenciaDatos(rows, grande) {
  const ref = hoy();
  let filas = [];
  if (grande) {
    filas = rows
      .map((r) => ({ nombre: r.dependencia, contrato: r.no_contrato || "", ini: parseFecha(r.fecha_inicio), fin: parseFecha(r.fecha_termino) }))
      .filter((f) => !esVacio(f.nombre) && f.ini && f.fin);
  } else {
    const mapa = new Map();
    for (const r of rows) {
      const ini = parseFecha(r.fecha_inicio);
      const fin = parseFecha(r.fecha_termino);
      if (esVacio(r.dependencia) || !ini || !fin) continue;
      const k = String(r.dependencia).trim();
      const g = mapa.get(k) || { nombre: k, ini, fin, contratos: new Set() };
      if (ini < g.ini) g.ini = ini;
      if (fin > g.fin) g.fin = fin;
      if (!esVacio(r.no_contrato)) g.contratos.add(String(r.no_contrato).trim());
      mapa.set(k, g);
    }
    filas = [...mapa.values()].map((g) => ({ nombre: g.nombre, contrato: `${g.contratos.size} contrato(s)`, ini: g.ini, fin: g.fin }));
  }
  filas = filas.map((f) => ({ ...f, estatus: estatusVigencia(f.fin, ref) })).sort((a, b) => a.fin - b.fin);
  return { filas, hoy: ref };
}
