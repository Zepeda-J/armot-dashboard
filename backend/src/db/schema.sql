-- Usuarios y servicios en Supabase (antes en SQLite). Es idempotente: se puede correr varias veces.
create table if not exists usuarios (
  id serial primary key,
  usuario text unique not null,
  password_hash text not null,
  rol text not null default 'usuario',
  creado_en timestamptz not null default now()
);

create table if not exists servicios (
  id serial primary key,
  dependencia text,
  estado text,
  empresa text,
  unidades double precision default 0,
  operarios_min double precision default 0,
  operarios_max double precision default 0,
  monto_min_sin_iva double precision default 0,
  monto_max_sin_iva double precision default 0,
  monto_min_con_iva double precision default 0,
  monto_max_con_iva double precision default 0,
  fecha_inicio text,
  fecha_termino text,
  no_contrato text,
  ejercicio_fiscal text,
  estatus text
);

-- Supabase expone el esquema public por su API REST con la llave anon.
-- Con RLS activo y sin políticas nadie puede leer estas tablas por ahí (los hashes de contraseña incluidos);
-- el backend entra con el usuario postgres de DATABASE_URL, que no está sujeto a RLS.
alter table usuarios enable row level security;
alter table servicios enable row level security;
