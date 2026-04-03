# Encuestas — Frontend (Vite + React + TypeScript)

Este repositorio está orientado al desarrollo local. No contiene pasos de despliegue a Vercel ni configuraciones remotas por defecto.

Objetivo: entorno local para desarrollo del frontend y funciones serverless locales que interactúan con Supabase.

Requisitos de entorno
- Crea un archivo `.env.local` en la raíz con las variables necesarias:

- `VITE_SUPABASE_URL` — URL pública de Supabase (para el cliente en navegador).
- `VITE_SUPABASE_ANON_KEY` — clave anon pública (para el cliente en navegador).
- `SUPABASE_URL` — URL de Supabase (usada por backend/scripts/funciones locales).
- `SUPABASE_SERVICE_ROLE_KEY` — Service Role (solo para uso local en backend/scripts/funciones; mantener secreto).
- `FUNCTIONS_PORT` — (opcional) puerto para el servidor de funciones locales (por defecto 8787/8788).

Instalación y desarrollo local
1. Instala dependencias en la raíz del proyecto:

```powershell
npm install
```

2. Levanta el frontend (Vite):

```powershell
npm run dev
```

3. Levanta el servidor de funciones local (necesita `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`):

```powershell
npm run dev:functions
```

Si quieres iniciar ambos (frontend + funciones) en una sola orden puedes usar el script combinado:

```powershell
npm run dev:all
```

También hay ejecutables de conveniencia en la raíz:

- `run-dev.ps1` — PowerShell wrapper que ejecuta `npm run dev:all`.
- `run-dev.cmd` — CMD wrapper que ejecuta `npm run dev:all`.

Ejemplo (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File run-dev.ps1
```

El servidor de funciones expondrá al menos `http://localhost:$FUNCTIONS_PORT/api/create_user` para pruebas locales.

Comandos útiles (mantenimiento local)

- Crear/actualizar rol de un usuario (requiere `SUPABASE_SERVICE_ROLE_KEY`):

```powershell
node backend/scripts/set_user_role.js --email admin@local.test --role admin
```

- Backfill de `app_users` desde `auth.users` (requiere `SUPABASE_SERVICE_ROLE_KEY`):

```powershell
node backend/scripts/backfill_app_users.js --all
```

- Ejecutar servidor de funciones manualmente (si prefieres no usar `npm`):

```powershell
# desde la raíz
node backend/scripts/dev_functions_server.js
```

Notas sobre seguridad
- Nunca subas `SUPABASE_SERVICE_ROLE_KEY` a un repositorio público. Úsalo solo en tu entorno local o en servidores de confianza.

Arquitectura y rutas principales
- Páginas principales del área `profesor` están en `src/profesor/pages/`.
- El cliente utiliza `src/services/supabaseClient.ts` para operaciones cotidianas y `backend/scripts/` contiene utilidades para tareas administrativas locales.

Si quieres que actualice alguna sección (por ejemplo, ejemplos de `curl` para probar `api/create_user` localmente o añadir instrucciones para autenticación local), dime y lo añado.
