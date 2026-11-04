# Despliegue: Pages (frontend) + Render (backend) + Supabase

## 1. Migrar usuarios y servicios a Supabase (una sola vez, en tu computadora)
1. En `backend/.env` pon `DATABASE_URL` de Supabase (la misma que ya usan Coordinadores/Facturación).
2. Desde `backend/`: `npm install` y luego `npm run migrar`
   (lee `data/armot.db` y crea las tablas `usuarios` y `servicios` en Supabase con `src/db/schema.sql`).
3. Salida esperada: `Supabase ahora: 13 usuarios, 13 servicios`. Se puede repetir sin duplicar nada.
4. Los hashes se copian tal cual: **cada usuario entra con la misma contraseña de siempre**.
5. Prueba local: `npm start` y entra con un usuario. Cuando funcione, `data/armot.db` ya no hace falta.

Las tablas quedan con RLS activo y sin políticas: la API pública de Supabase no puede leerlas;
solo el backend, que entra con el usuario de `DATABASE_URL`.

## 2. Backend en Render
- New + > Web Service > tu repo. Root Directory `backend`, Build `npm install`, Start `npm start`
  (o usa `render.yaml` como Blueprint).
- Variables (Environment): `DATABASE_URL`, `JWT_SECRET` (cadena larga y aleatoria; Render la puede generar),
  `FRONTEND_ORIGIN` (URL exacta del frontend, ver paso 3), `GEMINI_API_KEY` / `AI_*` si usas el asistente,
  `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- Google Drive: Environment > Secret Files > `service-account.json` con el JSON de la cuenta de servicio, y
  `GOOGLE_SERVICE_ACCOUNT_JSON=/etc/secrets/service-account.json`.
- Comprueba `https://TU-SERVICIO.onrender.com/api/health` → `{"ok":true,"supabase":true}`.
- En el plan gratis el servicio se duerme tras ~15 min sin tráfico; la primera petición tarda ~30-60 s.

## 3. Frontend en Pages
- Build command `npm run build`, output `dist`, root `frontend`.
- Variable de build `VITE_API_URL=https://TU-SERVICIO.onrender.com/api` (se incrusta al compilar: si la cambias, vuelve a desplegar).
- Con la URL final (por ejemplo `https://armot.pages.dev`) regresa a Render y ponla en `FRONTEND_ORIGIN`
  (sin `/` al final y sin ruta; en GitHub Pages es solo `https://usuario.github.io`).

## Pendientes de seguridad
- Tu `.env` local tiene `JWT_SECRET=cambia_este_secreto...`: no lo uses en Render.
- No subas `.env`, `data/` ni `secrets/` (ya van en `.gitignore`).
