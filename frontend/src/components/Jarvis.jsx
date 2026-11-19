import { useEffect, useRef, useState } from "react";
import { interpretar, quitarPalabraClave, textoParaVoz, trocear, ETIQUETAS, AYUDA_VOZ } from "../lib/comandosVoz";

// Asistente de voz estilo "Jarvis": escucha en segundo plano, se activa al oír su nombre y ejecuta órdenes
// (navegar, tema, panel lateral, asistente de IA…). Lo que no reconoce como orden se lo pregunta a la IA con tus datos.
// Usa las APIs nativas del navegador (SpeechRecognition y speechSynthesis): sin dependencias ni claves extra.
// Compatible con Chrome y Edge (escritorio y Android). Requiere HTTPS o localhost y permiso de micrófono.

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const VENTANA_MS = 8000; // tras una orden, 8 s para dar otra sin repetir "Jarvis"

const ESTADOS = {
  apagado: "Apagado",
  espera: "En espera · di «Jarvis»",
  escuchando: "Te escucho",
  pensando: "Consultando los datos…",
  hablando: "Hablando",
};

function elegirVoz() {
  const voces = window.speechSynthesis?.getVoices?.() || [];
  const puntaje = (v) => {
    const l = (v.lang || "").toLowerCase().replace("_", "-");
    if (!l.startsWith("es")) return -1;
    let p = l === "es-mx" ? 3 : l === "es-us" || l === "es-419" ? 2 : 1;
    if (/natural|online|google/i.test(v.name)) p += 1;
    return p;
  };
  return voces.map((v) => [v, puntaje(v)]).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export default function Jarvis({ pestanas, actual, onNavegar, tema, onTema, onLateral, onCerrarSesion, puedeIA }) {
  const [estado, setEstado] = useState("apagado");
  const [interino, setInterino] = useState("");
  const [linea, setLinea] = useState({ oido: "", dicho: "" });
  const [ayuda, setAyuda] = useState(false);
  const [error, setError] = useState("");

  const recRef = useRef(null);
  const activoRef = useRef(false);
  const hablandoRef = useRef(false);
  const ventanaRef = useRef(0);
  const ultimaRespRef = useRef("");
  const pendienteRef = useRef(null);
  const esperandoIARef = useRef(false);
  const idHablaRef = useRef(0);
  const reinicioRef = useRef(null);
  const intervaloRef = useRef(null);
  const audioRef = useRef(null);
  const procesarRef = useRef(() => {});
  const hablarRef = useRef(() => {});
  const propsRef = useRef({});
  propsRef.current = { pestanas, actual, onNavegar, tema, onTema, onLateral, onCerrarSesion, puedeIA };

  // ---------- Salida: voz y pitido ----------
  function pitido() {
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.15);
    } catch {
      /* sin audio: se ignora */
    }
  }

  function detenerVoz() {
    idHablaRef.current++;
    window.speechSynthesis?.cancel();
    if (hablandoRef.current) {
      hablandoRef.current = false;
      if (activoRef.current) {
        setEstado("espera");
        iniciarReconocimiento();
      }
    }
  }

  function terminarHabla() {
    hablandoRef.current = false;
    ventanaRef.current = Date.now() + VENTANA_MS;
    if (activoRef.current) {
      setEstado(esperandoIARef.current ? "pensando" : "escuchando");
      iniciarReconocimiento();
    } else setEstado("apagado");
  }

  function hablar(texto, { guardar = true } = {}) {
    if (guardar) ultimaRespRef.current = texto;
    setLinea((l) => ({ ...l, dicho: texto }));
    const synth = window.speechSynthesis;
    if (!synth) return; // sin síntesis de voz: el texto queda visible en el panel
    const id = ++idHablaRef.current;
    synth.cancel();
    hablandoRef.current = true;
    setEstado("hablando");
    try { recRef.current?.abort(); } catch { /* ya detenido */ } // no escucharse a sí mismo
    const voz = elegirVoz();
    const trozos = trocear(texto);
    const decir = (i) => {
      if (id !== idHablaRef.current) return; // cancelado o reemplazado por otra locución
      if (i >= trozos.length) return terminarHabla();
      const u = new SpeechSynthesisUtterance(trozos[i]);
      u.lang = voz?.lang || "es-MX";
      if (voz) u.voice = voz;
      u.rate = 1.05;
      u.pitch = 0.95;
      u.onend = () => decir(i + 1);
      u.onerror = () => id === idHablaRef.current && terminarHabla();
      synth.speak(u);
    };
    decir(0);
  }
  hablarRef.current = hablar;

  // ---------- Entrada: reconocimiento continuo ----------
  function crearReconocedor() {
    const rec = new SR();
    rec.lang = "es-MX";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      if (hablandoRef.current) return;
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) procesarRef.current(r[0].transcript);
        else parcial += r[0].transcript;
      }
      setInterino(parcial);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        apagar();
        setError("Permiso de micrófono denegado. Actívalo desde el candado de la barra de direcciones y vuelve a intentar.");
      } else if (e.error === "audio-capture") {
        apagar();
        setError("No se detectó ningún micrófono.");
      } else if (e.error === "network") {
        apagar();
        setError("No hay conexión con el servicio de voz del navegador.");
      }
      // "no-speech" y "aborted" son normales: onend reinicia la escucha
    };
    rec.onend = () => {
      setInterino("");
      // Chrome cierra la sesión tras un rato de silencio: se reabre mientras Jarvis siga encendido.
      if (activoRef.current && !hablandoRef.current) {
        clearTimeout(reinicioRef.current);
        reinicioRef.current = setTimeout(iniciarReconocimiento, 300);
      }
    };
    return rec;
  }

  function iniciarReconocimiento() {
    if (!SR || !activoRef.current || hablandoRef.current) return;
    if (!recRef.current) recRef.current = crearReconocedor();
    try { recRef.current.start(); } catch { /* ya estaba iniciado: onend lo reintenta si hace falta */ }
  }

  function encender() {
    if (!SR) return;
    setError("");
    try { audioRef.current = audioRef.current || new (window.AudioContext || window.webkitAudioContext)(); } catch { /* sin pitido */ }
    activoRef.current = true;
    ventanaRef.current = 0;
    setEstado("espera");
    iniciarReconocimiento();
    clearInterval(intervaloRef.current);
    // El estado visual vuelve a "en espera" cuando se cierra la ventana de 8 s.
    intervaloRef.current = setInterval(() => {
      if (!activoRef.current || hablandoRef.current || esperandoIARef.current) return;
      setEstado(Date.now() < ventanaRef.current ? "escuchando" : "espera");
    }, 500);
  }

  function apagar() {
    activoRef.current = false;
    esperandoIARef.current = false;
    pendienteRef.current = null;
    clearTimeout(reinicioRef.current);
    clearInterval(intervaloRef.current);
    idHablaRef.current++;
    window.speechSynthesis?.cancel();
    hablandoRef.current = false;
    try { recRef.current?.abort(); } catch { /* ya detenido */ }
    setInterino("");
    setEstado("apagado");
  }

  // ---------- Órdenes ----------
  function procesar(crudo) {
    const { llamado, resto } = quitarPalabraClave(crudo);
    if (!llamado && Date.now() >= ventanaRef.current) return; // ruido o conversación ajena
    setLinea({ oido: crudo.trim(), dicho: "" });
    if (llamado && !resto) {
      ventanaRef.current = Date.now() + VENTANA_MS;
      setEstado("escuchando");
      pitido();
      return;
    }
    ejecutar(resto);
  }
  procesarRef.current = procesar;

  function ejecutar(frase) {
    const p = propsRef.current;
    const it = interpretar(frase, { pestanas: p.pestanas });
    ventanaRef.current = Date.now() + VENTANA_MS;

    // Confirmación pendiente (cerrar sesión)
    const pend = pendienteRef.current;
    pendienteRef.current = null;
    if (pend && Date.now() < pend.hasta) {
      if (it.tipo === "si") { hablar("Hasta luego."); setTimeout(() => p.onCerrarSesion(), 900); return; }
      if (it.tipo === "no") { hablar("De acuerdo, sigo aquí."); return; }
    }
    if (it.tipo === "si" || it.tipo === "no" || it.tipo === "nada") return;

    const etiqueta = (id) => p.pestanas.find((t) => t.id === id)?.etiqueta || ETIQUETAS[id] || id;
    const sinIA = () => hablar("Tu usuario no tiene acceso al asistente de IA.");
    const ordenIA = (accion, texto) => window.dispatchEvent(new CustomEvent("armot:ia", { detail: { accion, texto } }));

    switch (it.tipo) {
      case "navegar":
        p.onNavegar(it.valor);
        return hablar(`Abriendo ${etiqueta(it.valor)}.`);
      case "sin_permiso":
        return hablar("Tu usuario no tiene acceso a esa pestaña.");
      case "pestana_rel": {
        const i = p.pestanas.findIndex((t) => t.id === p.actual);
        const sig = p.pestanas[(i + it.valor + p.pestanas.length) % p.pestanas.length];
        p.onNavegar(sig.id);
        return hablar(`${sig.etiqueta}.`);
      }
      case "tema": {
        const valor = it.valor === "alternar" ? (p.tema === "dark" ? "light" : "dark") : it.valor;
        p.onTema(valor);
        return hablar(valor === "dark" ? "Tema oscuro activado." : "Tema claro activado.");
      }
      case "lateral":
        p.onLateral(it.valor);
        return hablar(it.valor ? "Panel lateral visible." : "Panel lateral oculto.");
      case "ia_abrir":
        if (!p.puedeIA) return sinIA();
        ordenIA("abrir");
        return hablar("Asistente abierto. Te escucho.");
      case "ia_cerrar":
        if (!p.puedeIA) return sinIA();
        ordenIA("cerrar");
        return hablar("Asistente cerrado.");
      case "ia_nueva":
        if (!p.puedeIA) return sinIA();
        ordenIA("nueva");
        return hablar("Empecemos una conversación nueva.");
      case "scroll": {
        const caja = document.querySelector(".ia-hilo") || window;
        caja.scrollBy({ top: it.valor * window.innerHeight * 0.7, behavior: "smooth" });
        return;
      }
      case "hora":
        return hablar(`Son las ${new Date().toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}.`);
      case "fecha":
        return hablar(`Hoy es ${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`);
      case "saludo":
        return hablar("Hola, ¿en qué te ayudo?");
      case "gracias":
        return hablar("Para eso estoy.");
      case "ayuda":
        setAyuda(true);
        return hablar("Puedo cambiar de pestaña, ajustar el tema, abrir el asistente o responder preguntas sobre tus datos. Te dejo la lista en pantalla.");
      case "repetir":
        return ultimaRespRef.current ? hablar(ultimaRespRef.current, { guardar: false }) : hablar("Todavía no tengo nada que repetir.");
      case "detener":
        return detenerVoz();
      case "cerrar_sesion":
        pendienteRef.current = { hasta: Date.now() + 10000 };
        return hablar("¿Seguro que quieres cerrar sesión? Di sí o no.");
      case "ia":
        if (!p.puedeIA) return sinIA();
        esperandoIARef.current = true;
        setEstado("pensando");
        ordenIA("preguntar", it.texto);
        // Si la respuesta nunca llega, se libera el estado a los 90 s.
        setTimeout(() => { esperandoIARef.current = false; }, 90000);
        return hablar("Consultando.");
      default:
    }
  }

  // La respuesta de la IA (la emite AIAssistant) se lee en voz alta solo si la pregunta salió de Jarvis.
  useEffect(() => {
    const alResponder = (e) => {
      if (!esperandoIARef.current) return;
      esperandoIARef.current = false;
      const { respuesta, error: hubo, nGraficas } = e.detail || {};
      hablarRef.current(hubo ? `Hubo un problema. ${textoParaVoz(String(respuesta || "").replace(/^⚠️\s*/, ""), 0, 200)}` : textoParaVoz(respuesta, nGraficas));
    };
    window.addEventListener("armot:ia-respuesta", alResponder);
    return () => window.removeEventListener("armot:ia-respuesta", alResponder);
  }, []);

  // Al salir de la sesión (se desmonta el componente) se apaga el micrófono.
  useEffect(() => () => {
    activoRef.current = false;
    clearTimeout(reinicioRef.current);
    clearInterval(intervaloRef.current);
    window.speechSynthesis?.cancel();
    try { recRef.current?.abort(); } catch { /* ya detenido */ }
    audioRef.current?.close?.().catch?.(() => {});
  }, []);

  function alPulsar() {
    if (!SR) return;
    if (estado === "apagado") return encender();
    if (estado === "hablando") return detenerVoz();
    if (estado === "espera") { // atajo: hablar sin decir "Jarvis" (útil con ruido)
      ventanaRef.current = Date.now() + VENTANA_MS;
      pitido();
      return setEstado("escuchando");
    }
    if (estado === "escuchando") {
      ventanaRef.current = 0;
      setEstado("espera");
    }
  }

  const visible = estado !== "apagado" || error;
  const titulo = !SR
    ? "Tu navegador no admite reconocimiento de voz. Usa Chrome o Edge."
    : estado === "apagado" ? "Activar Jarvis (control por voz)"
    : estado === "hablando" ? "Toca para silenciar a Jarvis"
    : estado === "espera" ? "Toca para hablar sin decir «Jarvis»"
    : "Jarvis activo";

  return (
    <div className={`jarvis ${estado}`}>
      {visible && (
        <div className="jarvis-panel" role="status" aria-live="polite">
          <div className="jarvis-head">
            <b>Jarvis</b>
            <span className="jarvis-estado">{estado === "apagado" ? "" : ESTADOS[estado]}</span>
            <span style={{ flex: 1 }} />
            <button className="btn btn-icon" onClick={() => setAyuda((v) => !v)} aria-label="Lista de comandos" aria-expanded={ayuda}>?</button>
            {estado !== "apagado" && <button className="btn btn-icon" onClick={apagar} aria-label="Apagar Jarvis">⏻</button>}
          </div>
          {error && <p className="jarvis-error">{error}</p>}
          {(interino || linea.oido) && estado !== "apagado" && <p className="jarvis-oido">“{interino || linea.oido}”</p>}
          {linea.dicho && estado !== "apagado" && <p className="jarvis-dicho">{linea.dicho}</p>}
          {estado === "espera" && !interino && !linea.oido && <p className="jarvis-pista">Di «Jarvis» y tu orden, por ejemplo: «Jarvis, abre contratos».</p>}
          {ayuda && <ul className="jarvis-ayuda">{AYUDA_VOZ.map((a) => <li key={a}>{a}</li>)}</ul>}
        </div>
      )}
      <button className="jarvis-orb" onClick={alPulsar} disabled={!SR} title={titulo} aria-label={titulo} aria-pressed={estado !== "apagado"}>
        🎙️
      </button>
    </div>
  );
}
