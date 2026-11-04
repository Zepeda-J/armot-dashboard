# Dashboard Armot — Migración de Streamlit a React + Node.js

> **v2 · Rediseño.** El frontend se rehízo siguiendo el diseño de `Dash_armot_1.py` (ver sección "Rediseño v2" al final).

Primera entrega de la migración: **login + esqueleto completo** con las 6 pestañas
originales, datos de "Resumen Global" ya viviendo en SQLite (en vez de Google
Sheets), asistente de IA (Gemini) y explorador de Google Drive funcionales.
Coordinadores, Administradores, Facturación y Acuerdos quedan como pestañas
placeholder para la siguiente etapa.

## Estructura

```
armot-dashboard/
  backend/     Express + JWT + better-sqlite3
  frontend/    React + Vite
```

## Arranque rápido

### 1. Backend

```bash
cd backend
cp .env.example .env       # edita JWT_SECRET como mínimo
npm install
npm run seed                # crea la BD y usuarios (imprime contraseñas temporales)
npm run dev                  # http://localhost:4000
```

Guarda las contraseñas temporales que imprime `npm run seed`: no se
vuelven a mostrar. Pide a cada usuario que la cambie en cuanto entre
(el endpoint de cambio de contraseña no está incluido todavía; es
buen candidato para la siguiente etapa).

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

## Qué se migró y cómo

| Módulo original (Streamlit)              | Dónde quedó                                                   |
|-------------------------------------------|----------------------------------------------------------------|
| `USUARIOS` + login por sesión             | Tabla `usuarios` (bcrypt) + JWT (`POST /api/auth/login`)       |
| Datos desde Google Sheets (`cargar_datos`)| Tabla `servicios` en SQLite + `GET /api/servicios`             |
| Filtros en cascada (estado/dependencia/…) | `GET /api/servicios/filtros` + selects en `ResumenGlobal.jsx`  |
| Asistente IA (Gemini)                     | `POST /api/ai/chat` (mismo prompt y lógica de contexto)        |
| Explorador de Google Drive                | `GET /api/drive/tree` (googleapis) + `GoogleDrive.jsx`         |
| Pestañas Coordinadores/Administración     | Placeholder — pendientes (incluyen credencial PNG + QR + avatares, que no tienen equivalente directo en Node y se diseñarán aparte) |
| Facturación / Acuerdos                    | Placeholder — en el original tampoco tenían contenido          |

## Notas importantes

- **Contraseñas**: las del Streamlit original no se copiaron (estaban en texto
  plano en el código); `npm run seed` genera una temporal por usuario.
- **Datos de "servicios"**: se sembraron 4 filas de ejemplo. Sustitúyelas por
  tus datos reales (puedes escribir un script que lea tu Google Sheet una
  última vez y lo inserte en SQLite, o cargar un CSV/Excel exportado).
- **Google Drive**: necesitas una cuenta de servicio de Google con acceso de
  lector a la carpeta raíz, guardar su JSON en `backend/secrets/` y llenar
  `GOOGLE_SERVICE_ACCOUNT_JSON` y `GOOGLE_DRIVE_ROOT_FOLDER_ID` en `.env`.
  Sin esa configuración, la pestaña muestra un aviso en vez de tronar.
- **Gemini**: sin `GEMINI_API_KEY` el asistente responde que está desactivado,
  igual que en el original.

## Siguientes pasos sugeridos

1. Pestañas Coordinadores y Administradores: CRUD completo + generación de
   credencial PNG (usar `sharp` o `canvas` en Node) + QR (`qrcode` en npm).
2. Endpoint para cambiar contraseña propia y para que un admin gestione
   usuarios.
3. Migrar de SQLite a PostgreSQL si el equipo crece (ya está anotado como
   pendiente de hardening).
4. HTTPS + manejo de secretos fuera del repo en producción.

## Rediseño v2 (basado en Dash_armot_1.py)

- **Tema claro/oscuro** (botón en la barra lateral; recuerda tu elección y respeta el del sistema la primera vez).
- **Pestañas arriba** como en Streamlit: Resumen Global, Contratos, Coordinadores, Administración, Seguimiento de facturación, Acuerdos. "Contratos" es el explorador de Google Drive.
- **Resumen Global**: banner con degradado, panel de filtros a la izquierda (periodo fiscal con 2026 por defecto, Estado / Dependencia / Empresa operando / Estatus en cascada, resumen con chips, actualizar y exportar CSV), 4 tarjetas de montos (mín/máx sin y con IVA), 4 hallazgos (dependencia líder, estado líder, concentración top 3, semáforo de vigencia), panel de servicios con *Desglosar por / Medir / Enfocar en*, ranking de barras y vistas Composición, Vigencia, Dispersión y Detalle, botón 🔍 de **vista ampliada** y barra de estado.
- **Roles**: el rol `personal` solo ve Coordinadores y Administración (el backend además le responde 403 en servicios, IA y Drive).
- Los cálculos de filtros/KPIs/gráficas viven en `frontend/src/lib/resumen.js`; el backend solo entrega las filas (`GET /api/servicios`).

### Si ya habías corrido `npm run seed` antes

1. `cd backend && npm run seed` — agrega los usuarios nuevos (`Julio`, `Recepcion` con rol `personal`) y la columna `empresa`.
2. `npm run seed -- --reset-servicios` — reemplaza los datos de ejemplo por los 13 nuevos (con empresa, estatus y vigencias variadas). **Borra la tabla `servicios`**: no lo uses si ya cargaste datos reales.
3. Reinicia backend y frontend.

### Pendiente
Coordinadores, Administración, Seguimiento de facturación y Acuerdos tienen el banner y el diseño listo pero el contenido sigue "en construcción" (en el Streamlit usan Supabase).
