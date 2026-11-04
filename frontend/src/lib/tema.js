const CLAVE = "armot_tema";

export function temaInicial() {
  const guardado = localStorage.getItem(CLAVE);
  if (guardado === "light" || guardado === "dark") return guardado;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* modo privado: se ignora */
  }
}
