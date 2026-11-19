// Gráficas del asistente de IA.
// La IA NO escribe los números: solo propone una especificación (qué desglosar, qué medir, filtros)
// y este módulo calcula los valores reales con las filas de la tabla "servicios".

const DIMENSIONES = {
  dependencia: "Dependencia",
  estado: "Estado",
  empresa: "Empresa",
  estatus: "Estatus",
  ejercicio_fiscal: "Ejercicio fiscal",
};

const METRICAS = {
  monto_max_con_iva: "Monto máx. c/IVA",
  monto_min_con_iva: "Monto mín. c/IVA",
  monto_max_sin_iva: "Monto máx. s/IVA",
  monto_min_sin_iva: "Monto mín. s/IVA",
  unidades: "Unidades",
  operarios_min: "Operarios mín.",
  operarios_max: "Operarios máx.",
  contratos: "Contratos",
};

const TIPOS = ["barras", "barras_horizontales", "linea", "pastel"];
const AGREGACIONES = { suma: "suma", promedio: "promedio", maximo: "máximo" };
const MAX_DATOS = 20;
const MAX_PASTEL = 8;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const texto = (v) => (v == null ? "" : String(v).trim());
const vacio = (v) => ["", "nan", "none", "null", "undefined"].includes(texto(v).toLowerCase());
const norm = (s) => texto(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const redondear = (n) => Math.round(n * 100) / 100;
const mdp = (n) => `$${(n / 1e6).toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
const entero = (n) => Math.round(n).toLocaleString("es-MX");

function valoresUnicos(filas, clave) {
  return [...new Set(filas.map((f) => texto(f[clave])).filter((v) => !vacio(v)))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/** Valores que existen en cada dimensión (para que la IA use filtros que sí coinciden). */
function valoresDisponibles(filas) {
  return Object.fromEntries(Object.keys(DIMENSIONES).map((d) => [d, valoresUnicos(filas, d)]));
}

/** Tabla de totales por dimensión, ya calculada, para que la IA cite cifras exactas en su respuesta. */
function resumenPorDimension(filas, dimension, limite = 25) {
  const grupos = new Map();
  for (const f of filas) {
    const k = texto(f[dimension]);
    if (vacio(k)) continue;
    const g = grupos.get(k) || { unidades: 0, op: 0, max: 0, min: 0, contratos: new Set() };
    g.unidades += num(f.unidades);
    g.op += num(f.operarios_max);
    g.max += num(f.monto_max_con_iva);
    g.min += num(f.monto_min_con_iva);
    if (!vacio(f.no_contrato)) g.contratos.add(texto(f.no_contrato));
    grupos.set(k, g);
  }
  return [...grupos.entries()]
    .sort((a, b) => b[1].max - a[1].max)
    .slice(0, limite)
    .map(([k, g]) => `- ${k}: unidades=${entero(g.unidades)}, contratos=${g.contratos.size}, operarios_max=${entero(g.op)}, monto_max_con_iva=${mdp(g.max)}, monto_min_con_iva=${mdp(g.min)}`)
    .join("\n");
}

function filtrar(filas, filtros) {
  if (!filtros || typeof filtros !== "object") return filas;
  let resultado = filas;
  for (const dim of Object.keys(DIMENSIONES)) {
    const bruto = filtros[dim];
    if (bruto == null || bruto === "") continue;
    const permitidos = new Set((Array.isArray(bruto) ? bruto : [bruto]).map(norm));
    resultado = resultado.filter((f) => permitidos.has(norm(f[dim])));
  }
  return resultado;
}

function sanitizarTitulo(t) {
  return texto(t).replace(/[<>]/g, "").slice(0, 120);
}

/** Convierte una especificación de la IA en una gráfica con datos reales. Devuelve null si no es válida o no hay datos. */
function construirGrafica(spec, filasTodas) {
  if (!spec || typeof spec !== "object") return null;
  const dimension = texto(spec.dimension);
  const metrica = texto(spec.metrica);
  if (!DIMENSIONES[dimension] || !METRICAS[metrica]) return null;

  let tipo = TIPOS.includes(spec.tipo) ? spec.tipo : "barras";
  if (tipo === "linea" && dimension !== "ejercicio_fiscal") tipo = "barras"; // la línea solo tiene sentido en el tiempo
  const agregacion = AGREGACIONES[spec.agregacion] ? spec.agregacion : "suma";
  const orden = spec.orden === "asc" ? "asc" : "desc";
  const tope = Math.min(MAX_DATOS, Math.max(1, parseInt(spec.top, 10) || (tipo === "pastel" ? MAX_PASTEL : 10)));

  const filas = filtrar(filasTodas, spec.filtros);
  const grupos = new Map();
  for (const f of filas) {
    const k = texto(f[dimension]);
    if (vacio(k)) continue;
    const g = grupos.get(k) || { suma: 0, n: 0, max: -Infinity, contratos: new Set() };
    if (metrica === "contratos") {
      if (!vacio(f.no_contrato)) g.contratos.add(texto(f.no_contrato));
    } else {
      const v = num(f[metrica]);
      g.suma += v;
      g.n += 1;
      g.max = Math.max(g.max, v);
    }
    grupos.set(k, g);
  }

  let datos = [...grupos.entries()].map(([nombre, g]) => {
    let valor;
    if (metrica === "contratos") valor = g.contratos.size;
    else if (agregacion === "promedio") valor = g.n ? g.suma / g.n : 0;
    else if (agregacion === "maximo") valor = g.max === -Infinity ? 0 : g.max;
    else valor = g.suma;
    return { nombre, valor: redondear(valor) };
  });
  if (!datos.length) return null;

  if (tipo === "linea") {
    datos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
  } else {
    datos.sort((a, b) => (orden === "asc" ? a.valor - b.valor : b.valor - a.valor));
  }

  if (tipo === "pastel") {
    datos = datos.filter((d) => d.valor > 0);
    if (!datos.length) return null;
    if (datos.length > tope) {
      const resto = datos.slice(tope - 1);
      datos = [...datos.slice(0, tope - 1), { nombre: `Otros (${resto.length})`, valor: redondear(resto.reduce((a, d) => a + d.valor, 0)) }];
    }
  } else {
    datos = datos.slice(0, tope);
  }

  const etiquetaMetrica = METRICAS[metrica];
  return {
    tipo,
    titulo: sanitizarTitulo(spec.titulo) || `${etiquetaMetrica} por ${DIMENSIONES[dimension].toLowerCase()}`,
    metrica: etiquetaMetrica,
    dimension: DIMENSIONES[dimension],
    agregacion: metrica === "contratos" ? "conteo" : AGREGACIONES[agregacion],
    unidad: metrica.startsWith("monto") ? "dinero" : "numero",
    datos,
  };
}

/** Interpreta la salida del modelo: JSON con respuesta + especificaciones de gráficas. Si no es JSON, usa el texto tal cual. */
function interpretarSalida(bruto, filas) {
  const limpio = String(bruto).replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let obj = null;
  try {
    obj = JSON.parse(limpio);
  } catch {
    const a = limpio.indexOf("{");
    const b = limpio.lastIndexOf("}");
    if (a !== -1 && b > a) {
      try {
        obj = JSON.parse(limpio.slice(a, b + 1));
      } catch {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { respuesta: String(bruto).trim(), graficas: [] };

  let respuesta = Array.isArray(obj.respuesta) ? obj.respuesta.join("\n") : typeof obj.respuesta === "string" ? obj.respuesta : "";
  const specs = Array.isArray(obj.graficas) ? obj.graficas.slice(0, 3) : [];
  const graficas = specs.map((sp) => construirGrafica(sp, filas)).filter(Boolean);
  if (specs.length && !graficas.length) respuesta += "\n\n_No encontré datos para armar la gráfica con esos criterios._";
  if (!respuesta.trim()) respuesta = graficas.length ? "Aquí tienes la información solicitada." : "La IA no generó texto. Intenta reformular tu pregunta.";
  return { respuesta: respuesta.trim(), graficas };
}

module.exports = { DIMENSIONES, METRICAS, TIPOS, valoresDisponibles, resumenPorDimension, construirGrafica, interpretarSalida };
