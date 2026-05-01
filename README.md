# Sistema de Ventas de Rifas Escolares

Aplicación web para gestionar la venta de rifas con grilla interactiva, reservas temporales, integración real con MercadoPago Checkout Pro y BD edge en Turso.

> Estado: producción para evento escolar 2025 (cerrado). Reactivado en 2026 para nueva edición — ver `ESTADO.md`.

## Características

- Grilla interactiva configurable (default 2.000 números)
- Sistema de reservas temporales con timeout de 15 min
- Integración MercadoPago Checkout Pro + webhook IPN con verificación de firma
- BD edge en Turso (libSQL) con Drizzle ORM
- Lógica anti-sobreventa con tests de concurrencia automatizados
- Panel admin con métricas y listado de compras
- Auto-deploy en Vercel desde rama `main`

## Stack

Next.js 14 (App Router) · TypeScript strict · React 18 · Drizzle ORM · Turso · MercadoPago SDK 2 · Tailwind CSS · Zod

## Requisitos

- Node.js 18+
- Cuenta en [Turso](https://turso.tech)
- Cuenta en [MercadoPago Developers](https://www.mercadopago.com.ar/developers)
- Cuenta en [Vercel](https://vercel.com) (para deploy)

## Instalación local

```bash
# 1. Clonar
git clone https://github.com/roddb/sistema-ventas-rifas.git
cd "Sistema de ventas de rifas"

# 2. Instalar dependencias
npm install

# 3. Variables de entorno
cp .env.local.example .env.local
# editar .env.local con credenciales válidas (ver más abajo)

# 4. Crear BD Turso (primera vez)
turso auth login
turso db create rifas-db
turso db show rifas-db --url
turso db tokens create rifas-db
# pegar URL y token en .env.local

# 5. Aplicar migraciones
npm run db:generate
npm run db:migrate

# 6. Dev server
npm run dev
# http://localhost:3000
```

## Variables de entorno

Archivo `.env.local`:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...

MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...   # o TEST-... en sandbox
MERCADO_PAGO_PUBLIC_KEY=APP_USR-...
MERCADO_PAGO_WEBHOOK_SECRET=...

NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

> En Vercel, configurar las mismas variables en Project Settings → Environment Variables. **Production** debe usar credenciales `APP_USR-...`; **Preview** debe usar `TEST-...` para evitar cargar dinero real al probar.

## Comandos

```bash
npm run dev              # dev server en :3000
npm run build            # build de producción
npm start                # servir build (requiere build previo)
npm run lint             # ESLint

# Drizzle
npm run db:generate      # generar migraciones desde schema.ts
npm run db:migrate       # aplicar a Turso
npm run db:studio        # GUI Drizzle Studio en https://local.drizzle.studio

# Tests de concurrencia (requieren dev server corriendo)
node run-concurrency-test.js
node test-concurrency.js
node simple-test.js
```

## Estructura

```
.
├── app/                          # Next.js 14 App Router
│   ├── api/
│   │   ├── numbers/              # estado de la grilla
│   │   ├── purchase/             # ciclo de compra
│   │   ├── payment/              # callbacks MP (UX only)
│   │   ├── preference/           # creación de preference MP
│   │   ├── webhooks/mercadopago/ # webhook IPN (verdad sobre el pago)
│   │   ├── raffle/config/        # configuración dinámica de la rifa
│   │   ├── cron/cleanup/         # liberación de reservas expiradas
│   │   └── test/reset-numbers/   # solo-dev
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── RifasApp.tsx              # componente raíz
├── lib/
│   ├── db/                       # schema Drizzle + cliente
│   ├── services/raffleService.ts # lógica de negocio
│   └── mercadopago.ts            # cliente MP + helpers
├── drizzle.config.ts
├── CLAUDE.md                     # guía operativa para Claude Code
├── ESTADO.md                     # checklist de tareas + bitácora
├── MEMORIA.md                    # contexto y decisiones
├── BUGS.md                       # registro de bugs
├── LEARNINGS.md                  # aprendizajes técnicos
├── .claude/                      # hooks, commands, agents para Claude Code
└── old_docs/                     # documentación histórica (rifa 2025)
```

## Deploy en Vercel

```bash
# Opción A: CLI
npm i -g vercel
vercel              # preview
vercel --prod       # producción

# Opción B: GitHub auto-deploy
# push a main → Vercel deploya automáticamente a producción
```

Antes del primer deploy:

1. Cargar las 5 variables de entorno en Vercel (ver sección anterior)
2. Configurar el webhook MP apuntando a `https://<dominio>.vercel.app/api/webhooks/mercadopago`
3. Verificar con `curl` o Vercel logs que el endpoint responde 200

## Configuración de MercadoPago

1. Ir a [MP Developers Panel](https://www.mercadopago.com.ar/developers/panel)
2. Crear aplicación y copiar Access Token + Public Key
3. En "Webhooks" configurar URL `https://<dominio>/api/webhooks/mercadopago`, evento `payment`
4. Copiar el secret del webhook a `MERCADO_PAGO_WEBHOOK_SECRET`
5. Para testing: crear credenciales de sandbox en la misma app

Detalle paso a paso en `old_docs/TUTORIAL_MERCADOPAGO.md` y `old_docs/INTEGRACION_MERCADOPAGO.md` (referencia histórica de la rifa 2025).

## Anti-sobreventa: tests de concurrencia

```bash
# Terminal 1
npm run dev

# Terminal 2 (opcional, para inspección visual)
npm run db:studio

# Terminal 3
node run-concurrency-test.js
```

Cubre:
- 2 usuarios compitiendo por el mismo número
- 4 usuarios con números superpuestos (verifica que cada número se vende una sola vez)

Resultado esperado: cero conflictos, mensajes claros para los usuarios que pierden la carrera.

## Trabajando con Claude Code

Este repo tiene infraestructura de gestión madura en `.claude/` y archivos `CLAUDE.md`, `ESTADO.md`, `MEMORIA.md`, `BUGS.md`, `LEARNINGS.md`.

Comandos slash disponibles dentro de Claude Code:

- `/inicio` — sincroniza Git y carga contexto del proyecto
- `/save` — actualiza ESTADO/BUGS/MEMORIA y commitea + pushea
- `/autoaprendizaje` — captura aprendizajes en LEARNINGS.md y promueve reglas a CLAUDE.md
- `/allow` — agrega herramientas usadas en la sesión a `settings.local.json`
- `/test-concurrencia` — orquesta el test de concurrencia con dev server
- `/deploy-vercel` — pipeline de deploy con verificaciones previas

Agents disponibles vía `Task()`:

- `diagnosis-specialist` — análisis previo a cualquier cambio
- `payment-flow-debugger` — issues con MP (preference/callback/webhook)
- `concurrency-validator` — validación de cambios en `raffleService` o schema
- `db-migration-reviewer` — revisión de migraciones Drizzle antes de aplicar

## Troubleshooting

| Problema | Posible causa | Solución |
|----------|---------------|----------|
| Grilla no actualiza tras compra | caché de Next sin `dynamic = 'force-dynamic'` | revisar API routes con headers `no-cache` |
| Webhook MP rechaza notificaciones | firma HMAC inválida | revisar orden de campos en el manifest, ver `lib/mercadopago.ts` |
| Build falla en Vercel | env vars faltantes | `vercel env ls` y agregar las que falten |
| Compras quedan en `pending` | webhook no llega o falla silenciosamente | inspeccionar logs Vercel + `event_logs` en BD |
| Números se quedan `reserved` | cron `/api/cron/cleanup` no se ejecuta | configurar Vercel Cron en `vercel.json` |

## Licencia

MIT — desarrollado para evento escolar.
