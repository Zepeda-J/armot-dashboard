// Intérprete de comandos de voz del asistente "Jarvis". Funciones puras, sin dependencias del navegador.
// Flujo: texto reconocido → quitarPalabraClave() → interpretar() → { tipo, ... } que ejecuta Jarvis.jsx.

// Palabra de activación y variantes con las que el reconocedor suele transcribirla en español.
const PALABRA_CLAVE = /^\s*(?:(?:oye|hey|ey|ok|okay|hola|buenas)\s+)?(?:jarvis|yarvis|jarbis|yarbis|jarvi|garvis|charvis|harvis|jarvez|llarvis|yarvi)\b[\s,.:;!¡¿?-]*/i;

export function quitarPalabraClave(texto) {
  const m = String(texto || "").match(PALABRA_CLAVE);
  return m ? { llamado: true, resto: texto.slice(m[0].length).trim() } : { llamado: false, resto: String(texto || "").trim() };
}

// minúsculas, sin acentos ni signos, espacios colapsados: "¿Qué día es hoy?" → "que dia es hoy"
export function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DESTINOS = [
  { id: "resumen", re: /\b(resumen global|inicio|principal|global)\b|\bresumen$/ },
  { id: "contratos", re: /\bcontratos?\b/ },
  { id: "coordinadores", re: /\bcoordinad\w*/ },
  { id: "administracion", re: /\badministra\w*/ },
  { id: "facturacion", re: /\b(facturacion|seguimiento)\b/ },
  { id: "acuerdos", re: /\bacuerdos?\b/ },
];

const VERBO_NAVEGAR = /\b(ve|ir|vamos|abre|abrir|muestra|mostrar|muestrame|ensename|llevame|lleva|cambia|cambiar|navega|pestana|seccion|tab)\b/;
// Si la frase suena a pregunta sobre los datos, se manda a la IA aunque mencione una pestaña ("gráfica de contratos por estatus").
const PREGUNTA_DATOS = /\b(grafica|grafico|graficas|estadistica|estadisticas|cuantos|cuantas|cuanto|cual|cuales|monto|montos|promedio|total|totales|comparativo|compara|distribucion|ranking|porcentaje|que|como|quien|quienes|donde|por|mas|menos|dime|dame|cuentame|resume|resumeme|lista|enlista|hay|tiene|tienen|esta|estan|vencidas|vencidos|vencen|pendientes|activos|activas|inactivos|inactivas|vigentes|pagadas|pagados|bajas|folio|folios|factura|facturas)\b/;

const ABRIR = /\b(abre|abrir|muestra|mostrar|despliega|saca|activa|enciende)\b/;
const CERRAR = /\b(cierra|cerrar|oculta|ocultar|esconde|esconder|quita|quitar|desactiva)\b/;

/**
 * Convierte una frase (ya sin la palabra clave) en una intención.
 * @param {string} texto frase original reconocida
 * @param {{ pestanas?: {id:string}[] }} ctx pestañas visibles para el rol actual
 */
export function interpretar(texto, ctx = {}) {
  const n = normalizar(texto);
  if (!n) return { tipo: "nada" };
  const palabras = n.split(" ");

  // Respuesta a una confirmación pendiente (p. ej. cerrar sesión)
  if (/^(si|sí|claro|confirmo|confirmado|adelante|dale|hazlo|correcto)$/.test(n)) return { tipo: "si" };
  if (/^(no|nel|mejor no|cancela|cancelar|olvidalo)$/.test(n)) return { tipo: "no" };

  if (/\b(callate|silencio|detente|detener|para ya|ya basta|basta|cancela eso)\b/.test(n)) return { tipo: "detener" };
  if (/\b(que puedes hacer|que sabes hacer|ayuda|comandos|lista de comandos)\b/.test(n)) return { tipo: "ayuda" };
  if (/\b(repite|repitelo|repetir|dilo de nuevo|otra vez)\b/.test(n)) return { tipo: "repetir" };
  if (/\bque hora es\b|\bdime la hora\b|\bla hora\b$/.test(n)) return { tipo: "hora" };
  if (/\bque (dia|fecha) es( hoy)?\b|\bdime la fecha\b|\bfecha de hoy\b/.test(n)) return { tipo: "fecha" };
  if (/^(hola|buenos dias|buenas tardes|buenas noches|que tal|estas ahi)$/.test(n)) return { tipo: "saludo" };
  if (/^(gracias|muchas gracias|ok gracias|perfecto gracias)$/.test(n)) return { tipo: "gracias" };

  // Sesión (antes que "cierra …" genérico)
  if (/\b(cierra|cerrar|termina|terminar|salir de)\b.*\bsesion\b|\bcerrar sesion\b|^salir$/.test(n)) return { tipo: "cerrar_sesion" };

  // Tema
  if (/\b(tema|modo)\b.*\b(oscuro|noche|nocturno)\b|\bponlo oscuro\b/.test(n)) return { tipo: "tema", valor: "dark" };
  if (/\b(tema|modo)\b.*\b(claro|dia)\b|\bponlo claro\b/.test(n)) return { tipo: "tema", valor: "light" };
  if (/\b(cambia|cambiar|alterna|alternar)\b.*\b(tema|modo)\b/.test(n)) return { tipo: "tema", valor: "alternar" };

  // Asistente de IA (ventana de conversación)
  if (/\b(nueva conversacion|borra la conversacion|borrar conversacion|limpia el chat|limpiar chat|empezar de nuevo)\b/.test(n)) return { tipo: "ia_nueva" };
  if (/\b(asistente|chat)\b|\bla ventana\b/.test(n) && palabras.length <= 6) {
    if (CERRAR.test(n)) return { tipo: "ia_cerrar" };
    if (ABRIR.test(n) || /\b(asistente|chat)\b/.test(n) && palabras.length <= 2) return { tipo: "ia_abrir" };
  }
  if (/^cierra (la )?ventana$/.test(n)) return { tipo: "ia_cerrar" };

  // Panel lateral
  if (/\b(panel|menu|barra)( lateral)?\b|\bsidebar\b/.test(n) && palabras.length <= 6) {
    if (CERRAR.test(n)) return { tipo: "lateral", valor: false };
    if (ABRIR.test(n)) return { tipo: "lateral", valor: true };
  }

  // Desplazamiento
  if (/\b(baja|bajar|desplaza(te)? (hacia )?abajo|scroll abajo)\b/.test(n) && palabras.length <= 5) return { tipo: "scroll", valor: 1 };
  if (/\b(sube|subir|desplaza(te)? (hacia )?arriba|scroll arriba|ve arriba)\b/.test(n) && palabras.length <= 5) return { tipo: "scroll", valor: -1 };

  // Navegación entre pestañas
  const ids = (ctx.pestanas || []).map((p) => p.id);
  if (/\b(siguiente|proxima|adelante)\b/.test(n) && /\b(pestana|seccion|tab)\b/.test(n)) return { tipo: "pestana_rel", valor: 1 };
  if (/\b(anterior|previa|atras)\b/.test(n) && /\b(pestana|seccion|tab)\b/.test(n)) return { tipo: "pestana_rel", valor: -1 };

  const destino = DESTINOS.find((d) => d.re.test(n));
  if (destino && palabras.length <= 6 && !PREGUNTA_DATOS.test(n) && (VERBO_NAVEGAR.test(n) || palabras.length <= 3)) {
    return ids.length && !ids.includes(destino.id) ? { tipo: "sin_permiso", destino: destino.id } : { tipo: "navegar", valor: destino.id };
  }

  // Cualquier otra cosa se trata como pregunta para la IA
  return { tipo: "ia", texto: String(texto).trim() };
}

export const ETIQUETAS = {
  resumen: "Resumen Global",
  contratos: "Contratos",
  coordinadores: "Coordinadores",
  administracion: "Administración",
  facturacion: "Seguimiento de facturación",
  acuerdos: "Acuerdos",
};

export const AYUDA_VOZ = [
  "«Jarvis, abre contratos» (o cualquier pestaña)",
  "«pestaña siguiente» / «pestaña anterior»",
  "«tema oscuro» / «tema claro»",
  "«oculta el panel lateral» / «muestra el panel lateral»",
  "«abre el asistente» / «cierra el asistente»",
  "«nueva conversación»",
  "«baja» / «sube»",
  "«qué hora es» / «qué día es hoy»",
  "«repite» / «cállate»",
  "«cierra sesión»",
  "Cualquier otra frase se la pregunto a la IA con los datos de todas las pestañas: «¿cuántas facturas vencidas hay?», «¿qué acuerdos vencen pronto?», «¿cuántos coordinadores activos hay?»",
];

// Texto de una respuesta de la IA → algo cómodo de escuchar: sin tablas, sin Markdown y recortado.
export function textoParaVoz(markdown, nGraficas = 0, maxCaracteres = 420) {
  const limpio = String(markdown || "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() && !/^\s*\|/.test(l)) // las tablas se leen mal: se quedan en pantalla; líneas vacías fuera
    .map((l) => l.replace(/^\s*#{1,6}\s*/, "").replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[.)]\s+/, ""))
    .map((l) => (/[.!?:;…]$/.test(l.trim()) ? l.trim() : l.trim() + "."))
    .join(" ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/([.!?:;])\s*\.(\s|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();

  let salida = limpio;
  let recortado = false;
  if (salida.length > maxCaracteres) {
    const corte = salida.slice(0, maxCaracteres);
    const fin = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("? "), corte.lastIndexOf("! "));
    salida = fin > 120 ? corte.slice(0, fin + 1) : corte.replace(/\s+\S*$/, "") + "…";
    recortado = true;
  }
  const extras = [];
  if (nGraficas > 0) extras.push(nGraficas === 1 ? "Te muestro la gráfica en pantalla." : "Te muestro las gráficas en pantalla.");
  else if (recortado) extras.push("El resto está en pantalla.");
  return [salida || "Listo, está en pantalla.", ...extras].join(" ");
}

// Divide en frases cortas: Chrome corta las locuciones largas (~15 s) si se envían de una sola vez.
export function trocear(texto, max = 200) {
  const frases = String(texto).match(/[^.!?…]+[.!?…]*\s*/g) || [String(texto)];
  const trozos = [];
  for (const f of frases) {
    let resto = f.trim();
    while (resto.length > max) {
      const corte = resto.lastIndexOf(" ", max);
      const i = corte > 40 ? corte : max;
      trozos.push(resto.slice(0, i).trim());
      resto = resto.slice(i).trim();
    }
    if (resto) trozos.push(resto);
  }
  return trozos;
}
