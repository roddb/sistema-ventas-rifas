# Sistema de Ventas de Rifas

Guía operativa para Claude Code al trabajar en este repo.

## Overview

Sistema web para venta de rifas escolares con grilla interactiva (2.000 números), reservas temporales con timeout, integración real con MercadoPago Checkout Pro y BD edge en Turso. Usado en producción en evento escolar 2025; reactivado en 2026 para nueva edición.

- Producción: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app (Cloud Run, us-east1, proyecto sistema-ventas-rifas-prod)
- Repositorio: https://github.com/roddb/sistema-ventas-rifas
- Operación: ventas reales con dinero real → cero tolerancia a sobreventa o doble cobro
- Deploy manual a Google Cloud Run (us-east1) vía ./scripts/deploy.sh — sin auto-deploy

## Tech Stack

- Framework: Next.js 14.2.5 (App Router, React Server Components)
- Language: TypeScript 5.5.4 (strict mode)
- Runtime: React 18.3.1
- Database: Turso libSQL via @libsql/client 0.8.1
- ORM: Drizzle ORM 0.32.2 + drizzle-kit 0.23.2
- Payments: mercadopago SDK 2.0.15 (Checkout Pro + webhook IPN)
- Validation: Zod 3.23.8
- Email: Nodemailer 6.9.14 (post-purchase)
- Styling: Tailwind CSS 3.4.7 + lucide-react icons
- IDs: nanoid 5.1.5
- Hosting: Google Cloud Run (us-east1, proyecto sistema-ventas-rifas-prod, account intellego.ok@gmail.com)
- Container: Docker multi-stage Node 20 slim (Debian), imagen ~180 MB en Artifact Registry
- Secrets: Google Secret Manager (4 secrets críticos), env vars planas para los 4 valores públicos
- Package Manager: npm (NOT pnpm o yarn)

## Project Structure

- `app/`: Next.js 14 App Router
  - `page.tsx`: Página principal (mount de RifasApp)
  - `layout.tsx`: Layout global + globals.css
  - `api/`: Route handlers (App Router)
    - `numbers/route.ts` + `numbers/verify/route.ts`: estado de la grilla
    - `purchase/route.ts` + `purchase/cancel/route.ts`: ciclo de compra
    - `payment/{success,failure,pending,confirm,cancel}/route.ts`: callbacks Checkout Pro
    - `preference/route.ts`: creación de preference MercadoPago
    - `webhooks/mercadopago/route.ts`: webhook IPN (notificaciones de pago)
    - `raffle/config/route.ts`: configuración dinámica (precio, total, estado)
    - `cron/cleanup/route.ts`: liberación de reservas expiradas
    - `test/reset-numbers/route.ts`: utilitario solo-dev (resetea números)
- `components/`: UI React (`RifasApp.tsx` es el componente raíz)
- `lib/`: Lógica de negocio
  - `db/schema.ts`: Drizzle schema (raffles, raffle_numbers, purchases, purchase_numbers, event_logs)
  - `db/index.ts`: cliente libSQL singleton
  - `services/raffleService.ts`: business logic (reserva, compra, confirmación)
  - `mercadopago.ts`: cliente MP + helpers (preference, signature verify)
- `drizzle.config.ts`: configuración drizzle-kit
- `old_docs/`: documentación de versiones previas (no editar — referencia histórica)

## Commands

```bash
# Development
npm install                  # instalar deps
npm run dev                  # dev server en :3000
npm run build                # build de producción (.next/)
npm run start                # servir build (requiere build previo)
npm run lint                 # ESLint (Next config)

# Database (Drizzle + Turso)
npm run db:generate          # generar migraciones desde schema.ts
npm run db:migrate           # aplicar a Turso (drizzle-kit push:sqlite)
npm run db:studio            # GUI Drizzle Studio (https://local.drizzle.studio)

# Tests de concurrencia (manual, requiere dev server corriendo)
node run-concurrency-test.js # test orquestado (2 escenarios)
node test-concurrency.js     # test detallado (4 usuarios, 6 números)
node simple-test.js          # test simple

# Deploy (Cloud Run)
./scripts/deploy.sh                                  # build + deploy a producción
gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod  # estado actual
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod --limit=50  # logs

# Secret Manager
gcloud secrets versions add <SECRET_NAME> --data-file=- --project=sistema-ventas-rifas-prod  # rotar secret
gcloud secrets list --project=sistema-ventas-rifas-prod                                       # listar

# Session Management (Claude Code)
claude --continue            # retomar última sesión
claude --resume              # elegir sesión específica
```

## Code Style & Conventions

### Naming
- PascalCase: Components, Types, Interfaces (`RifasApp`, `Purchase`, `RaffleNumber`)
- camelCase: variables, functions, methods (`reserveNumbers`, `confirmPayment`, `isAvailable`)
- kebab-case: archivos y rutas (`raffle-service.ts`, `payment-confirm/`)
- UPPER_SNAKE_CASE: constantes (`PRICE_PER_NUMBER`, `RESERVATION_TIMEOUT`, `TOTAL_NUMBERS`)
- Boolean prefixes: is/has/should (`isReserved`, `hasExpired`, `shouldRefresh`)

### Imports
- Path aliases: usar relativos (`./lib/...`, `../components/...`) — no hay tsconfig paths configurados
- Orden: externos → internos → tipos
- ES modules siempre (`import/export`, nunca `require()`)

### TypeScript
- Strict mode siempre
- NUNCA `any` → usar `unknown` o uniones específicas
- Catch blocks: error tipado como `unknown`, narrow con `instanceof Error`
- Funciones públicas con tipo de retorno explícito
- `interface` para shapes, `type` para uniones/utilities
- Validar inputs de API con Zod antes de tocar la BD

### Formatting
- Indentación 2 espacios, semicolons obligatorios, single-quote en TS, double en JSX
- Trailing comma siempre en multilínea
- Arrow functions con paréntesis: `(x) => x`

## Critical Rules (DO NOT)

<critical_notes>

### Reglas de Pago (críticas — manejan dinero real)
- ❌ NUNCA marcar números como `sold` sin confirmación firmada del webhook MP
- ❌ NUNCA confiar en query params de los callback URLs (`/api/payment/success`) — pueden ser falsificados; la verdad la dicta el webhook
- ❌ NUNCA omitir verificación de firma HMAC en `/api/webhooks/mercadopago` (`MERCADO_PAGO_WEBHOOK_SECRET`)
- ❌ NUNCA usar credenciales TEST en producción ni credenciales PROD en preview
- ❌ NUNCA hacer cambios en el flujo de pago sin probar primero en sandbox MP
- ❌ NUNCA dejar números en `reserved` sin job de cleanup (timeout = 15 min)

### Reglas de Concurrencia (críticas — sobreventa = problema legal)
- ❌ NUNCA reservar/vender números fuera de una transacción (`db.transaction(...)`)
- ❌ NUNCA confiar en lectura previa para decidir disponibilidad — siempre `UPDATE ... WHERE status='available'` y chequear filas afectadas
- ❌ NUNCA fusionar reserva y compra en un solo paso — el usuario debe pasar por MP
- ❌ NUNCA hacer cambios al schema de `raffle_numbers` o `purchase_numbers` sin correr `node run-concurrency-test.js` después

### Reglas de Base de Datos
- ❌ NUNCA editar `raffle_numbers` directamente desde Turso CLI/Studio sin crear el `purchase` y `purchase_numbers` correspondiente (lección Historial.md sesión 1)
- ❌ NUNCA usar `drizzle-kit push:sqlite` en producción sin revisar migración generada
- ❌ NUNCA commitear `.env`, `.env.local`, ni el `TURSO_AUTH_TOKEN`
- ❌ NUNCA hardcodear `PRICE_PER_NUMBER`, `TOTAL_NUMBERS` ni configuración de la rifa — vive en tabla `raffles`
- ❌ NUNCA correr `/api/test/reset-numbers` en producción (debe estar gated por `NODE_ENV !== 'production'`)

### Reglas de Caché y UI
- ❌ NUNCA olvidar `export const dynamic = 'force-dynamic'` y `export const revalidate = 0` en API routes que tocan BD
- ❌ NUNCA persistir estado de números en `localStorage` — la fuente de verdad es la BD
- ❌ NUNCA bypass del refresh polling sin confirmar que el webhook ya actualizó la BD

### Reglas de Workflow
- ❌ NUNCA pushear cambios al flujo de pago durante horario de venta activa
- ❌ NUNCA hacer commit con `\n` literal en .md (regresión BUG-005 de PAIDEIA — se chequea en pre-commit-gate)
- ❌ NUNCA cerrar sesión sin actualizar ESTADO.md vía /save
- ❌ NUNCA correr `gcloud projects delete sistema-ventas-rifas-prod` ni `gcloud run services delete sistema-ventas-rifas` durante venta activa
- ❌ NUNCA editar valores en Secret Manager directamente desde Console UI; usar `gcloud secrets versions add` y forzar redeploy
- ❌ NUNCA commitear `scripts/deploy.sh` con valores hardcodeados; siempre leer de `.env.local`

</critical_notes>

## MCP Usage (recomendado)

| MCP | Propósito | Reemplaza |
|-----|-----------|-----------|
| **turso-cloud** | Queries a Turso (read-only para diagnóstico, write con cuidado) | curl, libsql CLI |
| **gcloud** | Deploy, logs, secret management, billing | dashboard GCP |
| **context7** | Docs de Next.js, Drizzle, MercadoPago SDK | búsquedas en Google/SO |
| **github** | PRs, issues, code search | gh CLI, web UI |

Las herramientas MCP están registradas en `.claude/settings.local.json`. Si necesitás una nueva, agregala con `/allow`.

## Development Workflow

<workflow>

**Secuencia obligatoria — DIAGNOSE → PLAN → EXECUTE → VALIDATE → DOCUMENT → COMMIT:**

1. **DIAGNOSE** → Antes de tocar nada, leer ESTADO.md (checklist), MEMORIA.md (contexto), BUGS.md (problemas conocidos), LEARNINGS.md (aprendizajes técnicos). Si el alcance no es obvio, lanzar el agent `diagnosis-specialist`.

2. **PLAN** → Identificar el agent o command apropiado:
   - `payment-flow-debugger`: cualquier issue con MP (preference, callbacks, webhook, IPN)
   - `concurrency-validator`: cambios en `raffleService` o schema `raffle_numbers`
   - `db-migration-reviewer`: cambios en `lib/db/schema.ts` antes de `db:generate`
   - `general-purpose`: tareas multi-paso sin agent específico
   - `Explore`: búsqueda en código

3. **EXECUTE** → Implementar siguiendo conventions y critical rules. Para flujos de pago, trabajar primero en sandbox MP.

4. **VALIDATE** → Antes de cerrar:
   - `npm run lint` (debe pasar)
   - `npm run build` (debe compilar — TypeScript estricto)
   - Si tocaste pago/reserva: `node run-concurrency-test.js` con dev server corriendo
   - Si tocaste schema: revisar migración generada antes de `db:migrate`
   - Si tocaste webhook: probar con MP sandbox + ngrok/Vercel preview

5. **DOCUMENT** → Actualizar al cierre de cada paso significativo:
   - ESTADO.md: marcar tarea, agregar entrada de bitácora
   - BUGS.md: si se descubrió/resolvió un bug
   - MEMORIA.md: decisiones de diseño nuevas
   - LEARNINGS.md: si surgió un aprendizaje técnico (o dejar que `/autoaprendizaje` lo capture)

6. **COMMIT** → Usar `/save`. El pre-commit gate verifica conflict markers, `\n` literal, archivos pesados.

No saltear etapas. Para cambios de alcance mayor, checkpoint con el usuario antes de EXECUTE.

</workflow>

## Patrones críticos del dominio

### Estados de un número
```
available  → libre, mostrado en verde en la grilla
reserved   → temporal, asociado a un purchase pending; expira en 15 min
sold       → confirmado por webhook MP; rojo en grilla; inmutable
```

### Flujo de compra (happy path)
```
1. Usuario selecciona N números → POST /api/numbers/verify (chequea disponibilidad)
2. POST /api/purchase → crea purchase(status=pending) + purchase_numbers + UPDATE raffle_numbers SET status='reserved'
3. POST /api/preference → crea MP preference y devuelve init_point
4. Frontend redirige a Checkout Pro
5a. Pago OK → MP webhook POST /api/webhooks/mercadopago → verifica firma → UPDATE purchase status='approved' + raffle_numbers status='sold'
5b. Pago fallido → MP webhook → UPDATE purchase status='rejected' + raffle_numbers status='available'
5c. Timeout (15min) → /api/cron/cleanup libera reservas pendientes
```

### Variables de entorno (`.env.local`)
```
TURSO_DATABASE_URL=libsql://<db>.turso.io
TURSO_AUTH_TOKEN=<token>
MERCADO_PAGO_ACCESS_TOKEN=<APP_USR-... o TEST-...>
MERCADO_PAGO_PUBLIC_KEY=<APP_USR-... o TEST-...>
MERCADO_PAGO_WEBHOOK_SECRET=<secret>
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # cambiar en prod
```

En Vercel: las mismas variables deben estar configuradas para Production y Preview (con credenciales TEST en preview, PROD en production).

### Tabla de la verdad
| Pregunta | Fuente |
|----------|--------|
| ¿Cuántos números totales tiene la rifa? | `raffles.totalNumbers` (no hardcodear) |
| ¿A cuánto está cada número? | `raffles.pricePerNumber` |
| ¿Está disponible este número? | `raffle_numbers WHERE id=? AND status='available'` (no localStorage, no caché) |
| ¿Qué compras hay del usuario X? | `purchases JOIN purchase_numbers WHERE buyerEmail=?` |
| ¿Pasó el pago? | `purchases.status` actualizado por webhook (no por callback URL) |
| ¿Hay sobreventa? | `purchase_numbers GROUP BY raffleNumberId HAVING COUNT(*) > 1` (debe dar 0 filas siempre) |

## Reglas aprendidas
<!-- Las reglas de esta sección son generadas por /autoaprendizaje. No editarlas manualmente. -->

- **2025-09-11** Convención usuario — Editar BD en Turso Studio sin crear los registros relacionados (`purchases`, `purchase_numbers`) genera inconsistencias. Si hace falta intervenir manualmente, hacerlo siempre con una transacción que toque las 3 tablas. _(Origen: primera sesión Sistema de ventas de rifas — se modificó `raffle_numbers` directamente, frontend mostraba estados inconsistentes)_

- **2025-09-11** Error evitable — Las API routes de Next.js 14 cachean por defecto. Para endpoints que tocan BD agregar `export const dynamic = 'force-dynamic'` y `export const revalidate = 0`. _(Origen: Historial.md — números no se actualizaban después de la compra por caché de Next)_

- **2025-09-11** Error evitable — `localStorage` para estado de compras causa inconsistencia con la BD. Siempre `useState` con fetch en mount + polling cada 30s. _(Origen: Historial.md — sesión 1, datos obsoletos en UI)_

- **2025-09-11** Convención técnica — `PRICE_PER_NUMBER` y `TOTAL_NUMBERS` deben venir de la tabla `raffles` vía `/api/raffle/config`, nunca hardcodeados en componentes. _(Origen: Historial.md — valor 500 hardcodeado contradecía $2000 de la BD)_

- **2025-09-11** Herramienta — Las variables de entorno en Vercel deben configurarse explícitamente en el dashboard; no se sincronizan automáticamente desde local. Usar `vercel env pull` para sincronizar al revés. _(Origen: integración MP, primer deploy fallido por falta de `MERCADO_PAGO_ACCESS_TOKEN` en Vercel)_

- **2025-09-14** Técnico — Las pruebas de concurrencia (`run-concurrency-test.js`) deben correrse con el dev server activo y delays aleatorios 0-200ms para simular condiciones reales. Cualquier cambio en `raffleService.reserveNumbers()` o el schema de `raffle_numbers` exige re-ejecutar el test. _(Origen: TEST_CONCURRENCIA.md)_

- **2026-05-04** Herramienta — Cualquier script Node de este repo que use `dotenv` para leer `.env.local` y conectarse a Turso/MP DEBE usar `loadEnv({ path: '.env.local', override: true })`. Sin `override: true`, dotenv 17.x respeta variables ya exportadas en el shell — el shell del dev tiene `TURSO_DATABASE_URL` apuntando a otra BD (`planificador-docente`), y un script descuidado tocaría la BD equivocada. Aplica a `scripts/*.mjs` y a cualquier helper de migración. _(Origen: bug pre-flight `scripts/setup-rifa-2026.mjs` 2026-05-04 — el script habría reseteado la BD equivocada de no haberse detectado)_

---

> Archivos de gestión: `ESTADO.md` (checklist + bitácora), `MEMORIA.md` (contexto y decisiones), `BUGS.md` (incidentes), `LEARNINGS.md` (aprendizajes técnicos), `README.md` (instalación y deploy).
> Commands: `/inicio` `/save` `/autoaprendizaje` `/allow` `/test-concurrencia` `/deploy-vercel`.
> Agents: `diagnosis-specialist` `payment-flow-debugger` `concurrency-validator` `db-migration-reviewer`.
