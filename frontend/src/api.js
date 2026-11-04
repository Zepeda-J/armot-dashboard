const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function obtenerToken() {
  return localStorage.getItem("armot_token");
}

async function solicitud(ruta, opciones = {}) {
  const token = obtenerToken();
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers || {}),
    },
  });

  if (respuesta.status === 401) {
    localStorage.removeItem("armot_token");
    localStorage.removeItem("armot_usuario");
    window.location.reload();
    throw new Error("Sesión expirada.");
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(datos.error || "Error de red.");
  }
  return datos;
}

const json = (metodo, cuerpo) => ({ method: metodo, body: JSON.stringify(cuerpo) });

export const api = {
  login: (usuario, password) => solicitud("/auth/login", json("POST", { usuario, password })),
  me: () => solicitud("/auth/me"),
  obtenerServicios: () => solicitud("/servicios"),
  preguntarIA: (pregunta) => solicitud("/ai/chat", json("POST", { pregunta })),
  obtenerArbolDrive: () => solicitud("/drive/tree"),

  // --- Tableros editables (facturacion | acuerdos) ---
  tablero: (clave) => solicitud(`/tableros/${clave}`),
  agregarFilas: (clave, filas, importar = false) => solicitud(`/tableros/${clave}`, json("POST", { filas, importar })),
  editarFila: (clave, id, datos) => solicitud(`/tableros/${clave}/${id}`, json("PUT", { datos })),
  eliminarFilas: (clave, ids) => solicitud(`/tableros/${clave}/eliminar`, json("POST", { ids })),

  // --- Personal (coordinadores | administracion) ---
  personal: (ruta) => solicitud(`/personal/${ruta}`),
  historialPersonal: (ruta) => solicitud(`/personal/${ruta}/historial`),
  crearPersona: (ruta, datos) => solicitud(`/personal/${ruta}`, json("POST", datos)),
  editarPersona: (ruta, id, datos) => solicitud(`/personal/${ruta}/${encodeURIComponent(id)}`, json("PUT", datos)),
  eliminarPersona: (ruta, id) => solicitud(`/personal/${ruta}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  async fotoPersona(ruta, id) {
    const token = obtenerToken();
    const r = await fetch(`${API_URL}/personal/${ruta}/${encodeURIComponent(id)}/foto`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return null;
    return r.blob();
  },
};

export function guardarSesion(token, usuario, rol) {
  localStorage.setItem("armot_token", token);
  localStorage.setItem("armot_usuario", JSON.stringify({ usuario, rol }));
}

export function obtenerSesion() {
  const token = obtenerToken();
  const usuarioGuardado = localStorage.getItem("armot_usuario");
  if (!token || !usuarioGuardado) return null;
  return { token, ...JSON.parse(usuarioGuardado) };
}

export function cerrarSesion() {
  localStorage.removeItem("armot_token");
  localStorage.removeItem("armot_usuario");
}
