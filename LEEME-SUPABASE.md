# Conexión a Supabase — 4 pestañas

Copia las carpetas `backend` y `frontend` de este zip sobre las de tu proyecto (te pedirá reemplazar
archivos: acepta). Después:

1. `cd backend` → `npm install pg`
2. Abre `backend/.env` y llena `DATABASE_URL` (ver `.env.example`). Es la URL de tu `.streamlit/secrets.toml`,
   en `[connections.supabase]` → `url`.
3. Reinicia el backend (`npm run dev`) y recarga el frontend.

Archivos nuevos: backend/src/db/supabase.js, routes/tableros.js, routes/personal.js,
frontend/src/tabs/Tablero.jsx, tabs/Personal.jsx, lib/tableros.jsx, lib/formato.js, styles-extra.css.
Archivos reemplazados: backend/src/server.js, frontend/src/App.jsx, frontend/src/api.js.
(backend/.env.example solo agrega la línea DATABASE_URL: no toques tu .env, solo agrégala.)
