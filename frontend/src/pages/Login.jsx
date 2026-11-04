import { useState } from "react";
import { api, guardarSesion } from "../api";

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const d = await api.login(usuario.trim(), password);
      guardarSesion(d.token, d.usuario, d.rol);
      onLogin({ usuario: d.usuario, rol: d.rol });
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={enviar}>
        <div className="login-logo" aria-hidden="true">🔒</div>
        <h1>Acceso al Corporativo de Limpieza</h1>
        <p>Ingresa tus credenciales para continuar.</p>
        <label className="field">
          <span className="field-label">Usuario</span>
          <input className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Contraseña</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={cargando}>{cargando ? "Ingresando…" : "Ingresar"}</button>
        {error && <div className="error-msg">{error}</div>}
      </form>
    </div>
  );
}
