# Estado del Proyecto: Sistema de Ventas de Rifas

## Información
- **Proyecto**: Sistema de Ventas de Rifas Escolares
- **Repositorio**: https://github.com/roddb/sistema-ventas-rifas
- **Producción**: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app (Cloud Run, us-east1)
- **Última edición productiva**: Septiembre–Octubre 2025 (rifa escolar 2025)
- **Estado actual**: Reactivación 2026 — proyecto dado de baja al cerrar la rifa anterior, vuelve a levantarse para nueva edición
- **Última sesión**: 2026-05-04 — Fase 2 cerrada (rifa 2026 configurada en BD productiva: 2.000 números a $2.000) + fix BUG-009 (loop infinito useEffect oculto por 8 meses)
- **Versiones previas de la documentación**: `old_docs/` (CLAUDE.md viejo, README, Historial, INTEGRACION_MERCADOPAGO, TUTORIAL_MERCADOPAGO, TEST_CONCURRENCIA)

---

## Checklist de Tareas

> Convención: `[ ]` pendiente · `[~]` en progreso · `[x]` completada · sufijo `- DEV` o `- TEST`.
> Las fases reflejan el plan de reactivación 2026. La estructura completa de gestión (CLAUDE.md, hooks, commands, agents) ya está creada (Fase 0).

### Fase 0: Gestión de proyecto (modernización 2026-05)
- [x] 0.1 Backup de archivos previos en `old_docs/` - DEV
- [x] 0.2 CLAUDE.md adaptado al stack actual (Next.js 14 + Drizzle + Turso + MP) - DEV
- [x] 0.3 ESTADO.md / MEMORIA.md / BUGS.md / LEARNINGS.md inicializados con histórico - DEV
- [x] 0.4 README.md reescrito (instalación + deploy + reactivación) - DEV
- [x] 0.5 `.claude/settings.json` con hooks versionados - DEV
- [x] 0.6 5 hooks adaptados: check-file-size, pre-commit-gate, stop-quality-gate, post-compact-context, problem-type-detector - DEV
- [x] 0.7 Commands: /inicio, /save, /autoaprendizaje, /allow, /test-concurrencia, /deploy-vercel - DEV
- [x] 0.8 Agents: diagnosis-specialist, payment-flow-debugger, concurrency-validator, db-migration-reviewer - DEV
- [x] 0.9 Verificar que `npm install`, `npm run lint`, `npm run build` funcionan tras 8 meses de inactividad - TEST
- [x] 0.10 Primer commit consolidando reactivación 2026 (gestión + lint config + PII gitignore) - DEV

### Fase 1: Reactivación técnica
- [x] 1.1 Revisar `package.json` y actualizar deps con vulnerabilidades críticas (npm audit) - DEV
- [x] 1.2 Verificar credenciales MercadoPago vigentes — token PROD vigente (verificado 2026-05-01 vía /users/me) - TEST
- [x] 1.3 Verificar conexión a Turso — BD operativa (verificado 2026-05-01) - TEST
- [x] 1.4 Verificar deploy productivo — Cloud Run us-east1 operativo, smoke tests verdes - TEST
- [~] 1.5 `npm run dev` local + smoke test sandbox MP - SKIPPED por decisión usuario 2026-05-02 — hacer pre-Fase 4 con TEST credentials para validar flujo de compra real
- [~] 1.6 Re-ejecutar `node run-concurrency-test.js` post fix BUG-008 - SKIPPED por decisión usuario 2026-05-02 — hacer pre-Fase 4, los locks optimistas de Task 3 alteran el camino crítico

### Fase 2: Configuración de la nueva rifa 2026
- [x] 2.1 Decidir parámetros: 2.000 números a $2.000, sin fecha de sorteo (manual), sin premios documentados - DEV
- [x] 2.2 Reset de la BD: backup completo a `backups/rifa-2025-backup-2026-05-04.json` (gitignored) + DELETE en orden por FKs (purchase_numbers → event_logs → purchases → raffle_numbers → raffles) - DEV
- [x] 2.3 INSERT en `raffles`: id=2, "Rifa Escolar 2026", totalNumbers=2000, pricePerNumber=2000, endDate=2026-12-31 placeholder, isActive=true - DEV
- [x] 2.4 Re-poblar `raffle_numbers` 1-2000 todos en `available`, batch en chunks de 500, validado por `db-migration-reviewer` - DEV
- [x] 2.5 Smoke test UI productiva: GET /api/raffle/config + GET /api/numbers OK; render frontend OK tras fix BUG-009 - TEST

### Fase 3: Mejoras priorizadas
> Items pendientes detectados en Historial.md sesión 2 + ideas nuevas. Re-priorizar antes de Fase 3.

- [ ] 3.1 Autenticación para panel admin (actualmente oculto pero accesible) - DEV
- [x] ~~3.2 Notificaciones por email post-compra exitosa~~ **DESCARTADO 2026-05-04** por decisión del usuario. Razón: el comprobante de MercadoPago ya incluye el detalle de los números comprados en el `title` del item (formato `"Rifa Escolar 2026 - Números: X, Y, Z"`), enviado al comprador automáticamente por MP. Nodemailer queda en `package.json` sin uso runtime; se podría desinstalar en una limpieza posterior.
- [ ] 3.3 Exportación de datos a Excel/CSV desde admin - DEV
- [ ] 3.4 Dashboard de estadísticas en tiempo real (ventas por día, top compradores) - DEV
- [ ] 3.5 Búsqueda de números por comprador (email/DNI) - DEV
- [ ] 3.6 Backup automático programado de la BD - DEV

### Fase 4: Lanzamiento
- [x] 4.1 Deploy a producción con configuración 2026 — revision `00010-jlz` con fixes de notification_url + back_urls + auto_return - DEV
- [x] 4.2 Smoke test E2E completo: compra real de Romi (`PUR-bv13rkdfQQ`, $2.000) tras fix BUG-010 cerró la cadena end-to-end (preference → MP → webhook firmado → BD `sold`) el 2026-05-04 15:54:12 - TEST
- [ ] 4.3 Anuncio del lanzamiento al colegio - DEV
- [ ] 4.4 Monitoreo activo primeras 24h post-lanzamiento - TEST

### Fase 5: Rediseño UI completo (2026-05-04)
> Spec aprobado: `docs/superpowers/specs/2026-05-04-rediseno-ui-completo-design.md`. Reemplaza el monolito `RifasApp.tsx` (1.587 líneas) por una arquitectura de componentes modular con sistema de design tokens, paleta institucional STA y panel admin con basic auth. Absorbe Fase 3.1 (auth admin) y parcialmente 3.3 (export CSV). Pre-requisitos: BUG-010 ya cerrado (env inline `localhost:3000`).
- [x] 5.0 Brainstorming + spec aprobado (2026-05-04) - DEV
- [ ] 5.A Fundamentos: tailwind tokens + componentes layout (AppHeader, StickyBottomBar, PageContainer) - DEV
- [ ] 5.B Pantallas públicas (Hero + Grid paginada + Form + Review + Success/Failure/Pending) - DEV
- [ ] 5.C Panel admin con basic auth + 3 tabs + export CSV - DEV
- [ ] 5.D Validación: smoke iPhone Safari + Android Chrome + desktop Chrome + concurrency test + deploy + compra real - TEST
- [ ] 5.E Logo STA y hex institucionales reales aplicados (cuando los pase el usuario) - DEV

---

## Bitácora

### 2026-05-05 — Save #4 (fix BUG-010 + cierre Fase 4.2 con compra real + brainstorm Fase 5)
- **Tareas completadas**: 4.2 (cerrada al 100% con compra real de Romi tras fix BUG-010) · 5.0 brainstorming + spec rediseño UI aprobado
- **Bugs cerrados**: BUG-010 (Next.js inline de NEXT_PUBLIC_BASE_URL hardcodeaba `http://localhost:3000` en bundle compilado vía `env` block en `next.config.js`)
- **Próxima tarea**: comenzar Fase 5.A (sistema de design tokens + componentes layout) usando `superpowers:writing-plans` para armar plan ejecutable. Pendientes pre-implementación: logo STA + hex institucionales reales (los pasa el usuario).
- **Acciones principales**:
  - **Bug urgente — BUG-010 detectado por compradora real**: Romi recibió 2 errores `CPT01` consecutivos al pagar ($2.000 con dinero disponible). Diagnóstico vía `gcloud secrets versions access` + `curl` a `/users/me` y `/checkout/preferences/{id}` reveló que las preferences tenían `back_urls={success:"",failure:"",pending:""}` y `notification_url="http://localhost:3000/api/webhooks/mercadopago"`. La cuenta MP estaba OK (sell.allow=true).
  - **Causa raíz**: `next.config.js` tenía bloque `env: { NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000' }` que **fuerza el inline en build time** incluso en server code. El Docker `RUN npm run build` no setea NEXT_PUBLIC_BASE_URL, así que cae al fallback `localhost:3000` y queda hardcoded en el JS compilado. La env var de runtime en Cloud Run nunca se leía.
  - **Fix**: removido el bloque `env` de `next.config.js`. Ahora `process.env.NEXT_PUBLIC_BASE_URL` se lee runtime del entorno Cloud Run (que estaba seteado correctamente).
  - **Cleanup paralelo de BD**: cancelladas 3 purchases pending de Romi + liberados números 1 y 2 + DELETE en purchase_numbers (todo con guards `WHERE status='reserved' AND purchase_id=...` y `payment_status='pending'`).
  - **Bonus fix**: título item MP corregido `"Rifa Escolar 2025"` → `"Rifa Escolar 2026"` en `lib/mercadopago.ts:44` (era hardcodeo de la rifa anterior).
  - **Validación post-deploy** (`sistema-ventas-rifas-00012-xrl`): smoke test inspeccionando preference vía MP API confirmó back_urls y notification_url con dominio Cloud Run. Compra real de Romi confirmó la cadena completa minutos después.
  - **Brainstorm rediseño UI completo (Fase 5)**: 4 sesiones de Q&A con visual companion (mockups en localhost). Decisiones cerradas: estilo "Moderno confiado" (Inter + bloques sólidos), paleta azul royal #1E3A8A + blanco #FAFBFD + ámbar #F59E0B, grilla paginada por centenas (B), 1 número por compra, panel admin in-scope con basic auth (absorbe Fase 3.1), 3 campos del estudiante, mobile-first single column.
  - **Spec escrito**: `docs/superpowers/specs/2026-05-04-rediseno-ui-completo-design.md` (492 líneas) cubre 7 pantallas + admin + tokens + estructura de componentes (~15 archivos chicos vs monolito de 1.587 líneas) + estrategia de migración (swap completo) + cronograma 6-9 sesiones.
  - **Fase 5 sumada a ESTADO.md** con 5 sub-tareas (5.0 a 5.E).
- **Archivos modificados**:
  - Código productivo: `lib/mercadopago.ts` (título 2026), `next.config.js` (sin bloque env)
  - Spec nuevo: `docs/superpowers/specs/2026-05-04-rediseno-ui-completo-design.md`
  - Config: `.gitignore` (patrón `.superpowers/` para mockups del visual companion)
  - Meta: `ESTADO.md`, `MEMORIA.md`, `BUGS.md`, `LEARNINGS.md`
- **Notas críticas**:
  - **Smoke tests automatizados de preference fueron insuficientes** para detectar BUG-010: validaron que `/api/preference` devuelve `200 + initPoint`, no inspeccionaron las URLs internas del preference creado (back_urls, notification_url). El bug se descubrió en compra real de un tercero. Patrón a replicar a futuro: en cualquier smoke E2E de pago, hacer `curl -H "Authorization: Bearer $MP_TOKEN" https://api.mercadopago.com/checkout/preferences/{id}` y validar URLs.
  - **2 deploys exitosos**: `00011-jdr` (fix título) y `00012-xrl` (fix BUG-010). Cero costos extra GCP.
  - **Fase 3.1 (auth admin)** absorbida en spec Fase 5 (admin con basic auth + tabs). Fase 3.3 (export CSV) parcialmente absorbida en el mismo. Fase 3.2 (email post-compra) sigue descartada.
  - El rediseño NO toca pago/concurrencia → no requiere `concurrency-validator` ni re-test inicial; el gate del concurrency test sigue siendo Fase 5.D (pre-deploy).
- **Stats sesión**: ~3h, 1 bug crítico cerrado en producción con compra real, 1 spec mayor escrito, 5 tareas completadas (4.2, 5.0, fixes), 2 deploys, 0 cargo extra GCP.

### 2026-05-04 — Smoke 4.2 parcial + descubrimiento de bug latente notification_url
- **Resumen**: Primera tentativa de compra real productiva falló con 500 en `/api/preference`. Diagnóstico revela 3 bugs en `lib/mercadopago.ts`: (1) `auto_return: 'approved'` rechazado por MP SDK v2.0.15 con error `back_url.success must be defined` aunque las URLs estaban presentes, (2) fallbacks de `back_urls` apuntaban a `https://sistema-ventas-rifas.vercel.app` (URL muerta desde migración Cloud Run 2026-05-02), (3) **bug crítico latente**: `notification_url` HARDCODED a `https://sistema-ventas-rifas.vercel.app/api/webhooks/mercadopago` — si MP usaba esa URL del payload, los webhooks de compras reales nunca habrían llegado a Cloud Run. Los tests E2E del fix BUG-008 pasaban porque la simulación dashboard MP usa la URL del panel (Cloud Run correcta), no la del payload.
- **Acciones**:
  - Fix 3-en-1 a `lib/mercadopago.ts`: removido `auto_return`, fallbacks y `notification_url` ahora derivan de `process.env.NEXT_PUBLIC_BASE_URL` con fallback a Cloud Run real.
  - Build verde + deploy → revision `sistema-ventas-rifas-00010-jlz`.
  - Cleanup BD: número 1 (id=2001) liberado, purchase `PUR-vPL-ObAmBB` cancelada vía 3 queries Turso MCP.
  - Smoke parcial automatizado (5 tests, sin user action):
    - **T1**: POST /api/purchase con bot data → 200 OK (`PUR-qaY-8MNqKH`, número 2 reservado).
    - **T2**: POST /api/preference con `purchaseId` → **200 + initPoint + sandboxInitPoint** (fix auto_return confirmado, access token productivo vigente).
    - **T3**: Cleanup BD post-T2.
    - **T4**: Webhook firma inválida → **401** (no regresión BUG-008-D).
    - **T5**: Webhook firma HMAC válida (manifest `id:<id>;request-id:<rid>;ts:<ms>;`, secret de Secret Manager, ts en ms) + paymentId ficticio `999999999` → **503 "Transient processing error"** (handler verifica firma OK, llama MP API, MP responde 404 al getPaymentInfo, propaga 503 → habilita retry policy MP). **Confirma fixes BUG-008-A/B/C/F/G en Cloud Run**.
- **Lo NO probado** (requiere acción externa): webhook con firma válida + paymentId REAL → BD pasa a `sold`. Para cubrirlo: (a) `claude mcp add` del MP MCP Server + tool `simulate_webhook` con payment_id real de TEST; o (b) compra real $2.000.
- **Decisión paralela del usuario**: SKIPPED rotación `MERCADO_PAGO_WEBHOOK_SECRET` (riesgo residual documentado anteriormente). Confirma URL webhook en panel MP (modo productivo): `https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/webhooks/mercadopago` ✓.
- **Próximo**: completar 4.2 con MCP MP o compra real. Después 4.3 (anuncio) y 4.4 (monitoreo). Considerar promover Fase 3.2 (email post-compra Nodemailer) a pre-anuncio para que comprador tenga registro independiente de los números asignados.
- **Archivos modificados**: `lib/mercadopago.ts` (-7 líneas auto_return; URLs derivadas de env), `ESTADO.md`, `MEMORIA.md`, `LEARNINGS.md`.

### 2026-05-04 — Cloud Scheduler para `/api/cron/cleanup` (gate 2 pre-Fase 4)
- **Resumen**: Configurado job de Cloud Scheduler `rifa-cleanup` (us-east1, TZ Buenos Aires, `*/5 * * * *`) para invocar `POST /api/cron/cleanup` con Bearer token. Reemplaza el auto-cron de Vercel perdido en la migración.
- **Acciones**:
  - Auditoría del endpoint: el handler ya soportaba `CRON_SECRET` opcional vía `Authorization: Bearer ...`, pero la env var no estaba seteada en Cloud Run → endpoint abierto a internet.
  - `gcloud services enable cloudscheduler.googleapis.com` (no estaba habilitada).
  - `openssl rand -hex 32 | gcloud secrets create cron-secret` (sin imprimir el valor en stdout).
  - IAM bind `secretAccessor` al SA de Cloud Run (`63979708570-compute@developer.gserviceaccount.com`).
  - `gcloud run services update --update-secrets=CRON_SECRET=cron-secret:latest` → revision `00009-mvp`.
  - Smoke test endpoint: sin auth → 401, auth correcta → 200, auth incorrecta → 401.
  - `gcloud scheduler jobs create http rifa-cleanup` con headers Bearer + attempt-deadline 60s.
  - Run manual + log Cloud Run muestra `Cleanup completed: { releasedNumbers: 0, cancelledPurchases: 0 }`.
- **Decisión paralela**: gate 1 (regenerar `MERCADO_PAGO_WEBHOOK_SECRET`) marcado SKIPPED por decisión del usuario; riesgo residual documentado en sección "Próxima tarea".
- **Próxima tarea**: Fase 4.1 — deploy con configuración 2026 (ya en prod, posiblemente solo confirmar revision actual). Después 4.2 smoke E2E con compra real de 1 número.
- **Archivos modificados**: ESTADO.md, MEMORIA.md, LEARNINGS.md. Sin cambios de código (CRON_SECRET es runtime config).

### 2026-05-04 — Save #3 (cierre de Fase 2 + fix BUG-009)
- **Tareas completadas**: 2.1 a 2.5 — Fase 2 al 100%
- **Bugs cerrados**: BUG-009 (loop infinito useEffect en RifasApp.tsx oculto por 8 meses detrás de `VENTAS_CERRADAS=true`)
- **Próxima tarea**: pre-Fase 4 (regenerar `MERCADO_PAGO_WEBHOOK_SECRET` + configurar Cloud Scheduler para `/api/cron/cleanup` cada 5 min) y luego 4.1 deploy / 4.2 smoke E2E con compra real. La Fase 3 (mejoras) queda postergada post-lanzamiento por decisión implícita del usuario.
- **Acciones principales**:
  - Script nuevo `scripts/setup-rifa-2026.mjs` con 2 modos (`--backup-only` y `--commit --yes`). Validado por `db-migration-reviewer` antes de ejecutar — el reviewer encontró bug bloqueante (orden DELETE iba a violar FK `event_logs.purchase_id → purchases.id`), corregido pre-ejecución.
  - Bug pre-flight `dotenv@17`: por default no sobrescribe vars del shell. El shell del dev tenía `TURSO_DATABASE_URL` exportada apuntando a `planificador-docente`, hubiese tocado la BD equivocada. Fix con `loadEnv({ override: true })`.
  - Reset productivo en transacción atómica: borrado de 1.500 raffle_numbers + 143 purchases + 950 purchase_numbers + 417 event_logs (rifa 2025) → INSERT 1 raffle nueva (id=2) + 2.000 raffle_numbers en chunks de 500.
  - Verificación API post-commit: `/api/raffle/config` devuelve la rifa 2026 correctamente; `/api/numbers` devuelve 2.000 disponibles.
  - **Smoke UI mostró 2 problemas hardcoded**:
    - Título "Rifa Escolar 2025" hardcoded en `RifasApp.tsx:1440` → cambio a `{raffleConfig?.title || 'Rifa Escolar'}`
    - Constante `VENTAS_CERRADAS = true` (línea 7) → cambio a `false` (deuda técnica anotada para promover a derivado de `raffleConfig.isActive`)
  - Tras el redeploy, la UI mostró la grilla colgada en "Cargando números..." indefinidamente → **BUG-009 descubierto**. Causa: `useEffect` con deps `[loadNumbers, selectedNumbers, currentStep, getNumberStatus]` donde `getNumberStatus` depende de `numbers` mutado por el propio effect → loop. Estuvo latente todo el 2025 oculto detrás del early-return de `VENTAS_CERRADAS=true`. Fix: separar el effect en dos (polling con dep única `loadNumbers` + validación de selección con deps reactivas pero sin disparar polling).
- **Archivos modificados**:
  - Nuevos: `scripts/setup-rifa-2026.mjs`, `backups/rifa-2025-backup-2026-05-04.json` (gitignored)
  - Código: `components/RifasApp.tsx` (3 cambios: `VENTAS_CERRADAS`, title hardcoded, useEffect split)
  - Config: `.gitignore` (patrón `backups/`)
  - Meta: `ESTADO.md`, `MEMORIA.md`, `BUGS.md`, `LEARNINGS.md`
- **Notas críticas**:
  - **MEMORIA.md tenía dato incorrecto**: la rifa 2025 corrió con **1.500 números, no 2.000**. Capturado en backup tal cual.
  - Inconsistencia preexistente en datos 2025: 167 sold sin entrada en purchase_numbers (BUG-H002 residual). Capturada en backup, irrelevante post-reset.
  - Cambio en flujo de UI (`VENTAS_CERRADAS=false` + nuevo split de effects) **NO toca el flujo de pago ni concurrencia** → no requiere re-test.
  - 2 deploys a Cloud Run: `00007-bbh` (cambio título + VENTAS_CERRADAS) y `00008-bg2` (fix BUG-009).
  - Pre-Fase 4 sigue pendiente: regenerar `MERCADO_PAGO_WEBHOOK_SECRET` (expuesto en chat 2026-05-02) + configurar Cloud Scheduler para cron cleanup (auto perdido en migración Vercel→Cloud Run).
- **Stats sesión**: ~2h, 2 deploys exitosos, 1 bug nuevo cerrado, 5 tareas completadas, 0 cargo extra GCP.

### 2026-05-02 — Save #2 (cierre de sesión consolidado)
- **Tareas completadas**: 1.1 (npm audit), 1.2 (credenciales MP), 1.3 (conexión Turso), 1.4 (deploy productivo en Cloud Run)
- **En progreso / SKIPPED**: 1.5 y 1.6 saltadas conscientemente por el usuario para arrancar Fase 2 directo en próxima sesión. Ambas cubiertas funcionalmente por la 4.2 (smoke E2E con compra de prueba).
- **Bugs cerrados**: BUG-007 (Vercel pause → resuelto vía migración Cloud Run), BUG-008 (webhook acepta firmas inválidas → resuelto con 7 sub-bugs identificados y corregidos)
- **Próxima tarea**: 2.1 — Decidir parámetros rifa 2026 (total números, precio, fecha sorteo, premios). Plan completo de Fases 2→4 documentado al final de este archivo.
- **Archivos modificados** (entre los principales):
  - Código nuevo: `lib/webhook-verification.ts`, `tests/webhook-verification.test.mjs`, `tests/run-tests.sh`, `Dockerfile`, `.dockerignore`, `scripts/deploy.sh`, `public/.gitkeep`
  - Código modificado: `app/api/webhooks/mercadopago/route.ts`, `lib/services/raffleService.ts`, `next.config.js`, `package.json`, `package-lock.json`
  - Meta: `CLAUDE.md`, `MEMORIA.md`, `ESTADO.md`, `BUGS.md`, `LEARNINGS.md`
  - Config: `.claude/commands/deploy.md` (renombrado desde deploy-vercel.md), `.claude/hooks/pre-commit-gate.sh`
  - Docs: `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`, `docs/superpowers/plans/2026-05-02-migracion-cloud-run.md`, `docs/superpowers/plans/2026-05-02-fix-bug-008-webhook-mp.md`
- **Notas**:
  - Sesión muy larga (~5h efectivas): brainstorming + writing-plans + subagent-driven-development × 2 ciclos completos (migración + fix BUG-008).
  - Cualquier cambio futuro al flujo de pago o concurrencia REQUIERE re-test (`node run-concurrency-test.js`) y smoke E2E sandbox MP — convención reforzada por las skipped 1.5/1.6.
  - `MERCADO_PAGO_WEBHOOK_SECRET` fue expuesto en chat durante diagnóstico Task 4 BUG-008. Acción crítica pre-Fase 4: regenerarlo.
  - Cron scheduler externo para `/api/cron/cleanup` quedó pendiente — en Vercel había auto, en Cloud Run hay que configurar Cloud Scheduler.
- **Stats sesión**: 18 commits desde el inicio, 7 sub-bugs documentados, 15 tests unitarios + 4 tests E2E pasando, 0 cargo en GCP (100% Free Tier).

### 2026-05-02 — BUG-008 cerrado al 100% (webhook MercadoPago seguro para Fase 4)
- **Resumen**: Fix completo de BUG-008 + 6 sub-bugs encadenados (008-A a 008-F) identificados por `diagnosis-specialist`, más BUG-008-G descubierto durante E2E (ts en ms). Webhook ahora valida firmas legítimas, rechaza bypasses, es idempotente y maneja correctamente la política de retries de MP.
- **Bugs resueltos**: BUG-008 base + 008-A (manifest mal construido) + 008-B (parseo posicional) + 008-C (timingSafeEqual sin guard) + 008-D (bypass sin header) + 008-E (no idempotencia) + 008-F (200 en errores transitorios) + 008-G (ts en ms vs segundos)
- **Acciones**:
  - Plan: `docs/superpowers/plans/2026-05-02-fix-bug-008-webhook-mp.md` (6 tasks)
  - 6 commits ejecutados con subagent-driven-development:
    - 3627d28: módulo verifyMercadoPagoWebhookSignature + 13 tests TDD
    - c1404b8: handler reescrito (cerrar bypasses)
    - 4cb6977: nits del review de Task 2
    - 3e3b3b7: idempotencia + locks optimistas en confirmPayment + cleanup
    - 8501c2a: nits del review de Task 3 (cancelPayment con guards, log PAYMENT_CONFLICT)
    - 6233846: normalizar ts en milisegundos (BUG-008-G E2E)
  - Reviewers obligatorios pasaron: spec compliance + code quality + concurrency-validator + db-migration-reviewer en cada task aplicable
  - 15 tests unitarios passing
  - 4 tests E2E passing (último: simulación MP dashboard → "Webhook signature verified successfully")
- **Archivos modificados**: `lib/webhook-verification.ts` (nuevo), `tests/webhook-verification.test.mjs` (nuevo), `tests/run-tests.sh` (nuevo), `app/api/webhooks/mercadopago/route.ts`, `lib/services/raffleService.ts`, `package.json`
- **Pendiente**:
  - Auditoría retroactiva de event_logs 2025 (no crítica, separable)
  - Regenerar `MERCADO_PAGO_WEBHOOK_SECRET` (fue expuesto en chat durante diagnóstico)
- **Próxima tarea**: 1.5 — `npm run dev` local + smoke test del flujo completo en sandbox MP, ahora con webhook seguro post-BUG-008.

### 2026-05-02 — Migración Vercel → Cloud Run completada
- **Resumen**: Cuenta Vercel del usuario quedó pausada por flag de uso comercial; proyecto eliminado por la pausa. Migración completa a Google Cloud Run (us-east1) bajo cuenta intellego.ok@gmail.com.
- **Tareas completadas**: 1.4
- **Acciones**:
  - Spec: `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`
  - Plan: `docs/superpowers/plans/2026-05-02-migracion-cloud-run.md`
  - Repo: `Dockerfile`, `.dockerignore`, `scripts/deploy.sh`, `public/.gitkeep` nuevos; `next.config.js` con `output: 'standalone'`
  - GCP: proyecto `sistema-ventas-rifas-prod` (project number 63979708570) con billing, 4 APIs habilitadas, 2 repos Artifact Registry con cleanup policy, 4 secrets en Secret Manager, Cloud Run service `sistema-ventas-rifas` en us-east1
  - URL pública: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app
  - Smoke tests OK: HTTP 200 (250ms), /api/raffle/config conecta a Turso, logs sin errores
  - Webhook MP actualizado a la nueva URL, simulación devolvió 200
- **Bugs detectados**: BUG-008 (handler webhook acepta firmas inválidas — preexistente)
- **Próxima tarea**: 1.5 — `npm run dev` local + smoke test del flujo completo en sandbox MP. Considerar priorizar fix de BUG-008 antes de Fase 4.
- **Archivos modificados**: ver Plan + meta-docs (CLAUDE/MEMORIA/ESTADO/BUGS/LEARNINGS) + `.claude/commands/deploy.md`

### 2026-05-01 — Tarea 1.1 completada (npm audit + bump de seguridad)
- **Resumen**: Auditoría de dependencias tras 8 meses de pausa. Reducción de 40 → 13 vulnerabilidades, 0 críticas restantes. Resto aceptado con justificación documentada.
- **Tareas completadas**: 1.1
- **Acciones**:
  - `@types/nodemailer` pinned a `6.4.15` exact (era `^6.4.15`, había drift a 6.4.19 que arrastraba `@aws-sdk/client-ses` real con 18 vulns transitivas; el paquete de tipos no debería traer runtime deps)
  - `next` 14.2.5 → 14.2.35 (patch dentro de la 14.2 line — no breaking; fix de 17 advisories incluyendo 2 critical: auth bypass + cache poisoning + SSRF)
  - `eslint-config-next` 14.2.5 → 14.2.35 (sincroniza)
  - Verificada explotabilidad de drizzle-orm SQL injection (GHSA-gpj5-g38j-94v9): NO explotable — el código no usa `sql.identifier()`, `sql.raw()` ni interpolación dinámica de identifiers
- **Vulns residuales aceptadas (13)**: Next residuales (sin fix en 14.2.x), drizzle-orm <0.45.2 (no explotable), nodemailer <8.0.4 (sin uso runtime, fixear en Fase 3.2), glob/minimatch/esbuild/postcss (dev-only o transitive sin superficie), uuid en mercadopago (afecta v3/v5/v6 con buf, MP usa v4 sin buf)
- **Validación**: `npm run lint` ✓ (3 warnings preexistentes), `npm run build` ✓ (7 rutas API + página)
- **NO ejecutado**: `npm audit fix --force` — habría bajado mercadopago a 0.5.0 (catastrófico para flujo de pago)
- **Próxima tarea**: 1.2 — Verificar credenciales MercadoPago vigentes (token PROD puede haber expirado)
- **Archivos modificados**: `package.json`, `package-lock.json`, `ESTADO.md`, `LEARNINGS.md`

### 2026-05-01 — Save #1 (verificación técnica + cierre de Fase 0)
- **Resumen**: Cierre de Fase 0. Se verificó que `npm run lint` y `npm run build` pasan tras 8 meses de inactividad. En el proceso se detectaron y corrigieron tres issues de scaffolding/seguridad.
- **Tareas completadas**: 0.9, 0.10 (Fase 0 al 100%)
- **Acciones**:
  - Creado `.eslintrc.json` con preset `next/core-web-vitals` (no existía — `next lint` se quedaba esperando input interactivo y rompía el stop-quality-gate)
  - Corregidos 4 errores `react/no-unescaped-entities` en `components/RifasApp.tsx` (líneas 1180, 1217 — comillas `"` → `&quot;`)
  - Detectados 2 archivos con datos productivos en working tree (`ventas_rifas_completo_2025.csv` con PII de compradores reales, `numeros_disponibles_venta.txt`); agregados al `.gitignore` antes de commitear → BUG-006
  - Build de producción genera 7 rutas API + página principal sin errores
- **Pendientes detectados**: 3 warnings `react-hooks/exhaustive-deps` en `RifasApp.tsx` (líneas 629, 665, 683) — preexistentes, no rompen build, abordar antes de Fase 3
- **Próxima tarea**: 1.1 — Revisar `package.json` y correr `npm audit` para detectar vulnerabilidades críticas tras 8 meses sin updates
- **Archivos modificados**: `.eslintrc.json` (nuevo), `.gitignore` (PII), `components/RifasApp.tsx` (escapes), `ESTADO.md`, `BUGS.md`, `MEMORIA.md`

### 2026-05-01 — Save #0 (modernización de gestión)
- **Resumen**: Tras 8 meses de inactividad, se moderniza la infraestructura de gestión del proyecto a partir del patrón gold standard de Intellego Platform, Diseño_cuadernillos y Auditoría PAIDEIA.
- **Acciones**:
  - Backup en `old_docs/` de los 6 .md previos (CLAUDE, README, Historial, INTEGRACION_MERCADOPAGO, TUTORIAL_MERCADOPAGO, TEST_CONCURRENCIA) y de `.claude/settings.local.json`
  - Creación de CLAUDE.md, ESTADO.md, MEMORIA.md, BUGS.md, LEARNINGS.md, README.md
  - Creación de `.claude/settings.json` con hooks versionados
  - 5 hooks adaptados al contexto rifas (check-file-size, pre-commit-gate con anti-`\n` literal, stop-quality-gate con `npm run lint && npm run build`, post-compact-context con reglas MP/Turso, problem-type-detector con workflows pago/concurrencia/deploy/db)
  - 6 commands creados: `/inicio`, `/save`, `/autoaprendizaje`, `/allow`, `/test-concurrencia`, `/deploy-vercel`
  - 4 agents creados: `diagnosis-specialist`, `payment-flow-debugger`, `concurrency-validator`, `db-migration-reviewer`
- **Próxima tarea**: 0.9 — verificar que `npm install`, `npm run lint`, `npm run build` siguen pasando tras 8 meses
- **Notas**: La BD productiva tiene datos de la rifa 2025; antes de la rifa 2026 hay que limpiar (Fase 2.2). Las credenciales MP pueden haber rotado; verificar en Fase 1.2.

### 2025-09-26 — Sesión histórica (test de concurrencia)
- **Resumen**: Se implementó la suite de tests de concurrencia (`run-concurrency-test.js`, `test-concurrency.js`, `simple-test.js`).
- **Logros**: Cobertura de 2 escenarios (conflicto directo entre 2 usuarios sobre el mismo número, conflictos múltiples entre 4 usuarios).
- **Estado**: Tests pasando, sin sobreventa detectada.
- **Doc original**: `old_docs/TEST_CONCURRENCIA.md`

### 2025-09-11 — Sesión histórica (integración MercadoPago)
- **Resumen**: Sesión intensiva de debugging + integración MP completa, eliminación de simulaciones.
- **Logros**:
  - Eliminados todos los botones de simulación de pago
  - Integración con Checkout Pro
  - Webhook IPN funcional con verificación de firma
  - Variables de entorno configuradas en Vercel
  - Eliminados valores hardcodeados (precio, total) → ahora vienen de la BD
  - Eliminado `localStorage` para purchases → fuente de verdad es la BD
  - Header clickeable, año actualizado a 2025, panel admin oculto
- **Bugs resueltos en esta sesión**: BUG-H001 (desincronización BD-frontend), BUG-H002 (caché de Next), BUG-H003 (localStorage obsoleto), BUG-H004 (precio hardcodeado), BUG-H005 (TS argumento extra en webhook MP)
- **Doc original**: `old_docs/Historial.md`

---

## Próxima tarea (post-restart Claude Code 2026-05-04 13:38)

**MCP MP conectado y autenticado** (OAuth completado en sesión 2026-05-04 tarde con access token TEST `APP_USR-5838101724285181-...`). Requiere restart de Claude Code para que las tools `mcp__mercadopago__*` queden registradas.

**Acción inmediata al retomar**:
1. Verificar inventario de tools: deberían aparecer `mcp__mercadopago__simulate_webhook`, `mcp__mercadopago__notifications_history_diagnostics`, `mcp__mercadopago__create_test_user`, etc.
2. Cerrar 4.2 al 100% con `simulate_webhook` contra Cloud Run revision `00010-jlz` usando un payment_id real de TEST. Esto valida la cadena: firma HMAC + manifest oficial + handler verifica + llama MP API + MP responde con datos reales del payment de TEST + handler actualiza BD a `sold`.
3. Pre-paso del smoke: crear una purchase fake en BD (POST /api/purchase con datos bot, número 3 por ejemplo) para tener un `purchaseId` que el `external_reference` del payment apunte a algo real. El payment de TEST tiene un `external_reference` configurable.
4. Limpiar BD post-test (3 queries Turso MCP: DELETE purchase_numbers, UPDATE raffle_numbers a available, UPDATE purchases a cancelled) o mantener la compra "completada" como prueba de éxito (decisión del usuario).
5. Tras 4.2 al 100%: pasar a 4.3 (anuncio) y 4.4 (monitoreo 24h).

## Próxima tarea (legacy)

**Pre-Fase 4 (gates de seguridad)** — antes del lanzamiento real:
1. ~~Regenerar `MERCADO_PAGO_WEBHOOK_SECRET`~~ — **SKIPPED por decisión del usuario 2026-05-04**. El secret fue expuesto en chat el 2026-05-02 durante diagnóstico BUG-008; el usuario decide no rotarlo. **Riesgo residual**: un atacante con acceso a la transcripción podría firmar webhooks falsos que el handler aceptaría como legítimos. Mitigaciones existentes: handler reconfirma vía `getPaymentInfo(paymentId)` contra MP API + filtro por `external_reference` rechaza IDs no asociados a esta cuenta. Acción de fallback documentada: `gcloud secrets versions add mp-webhook-secret --data-file=-` + redeploy si aparecen `event_logs` con `WEBHOOK_RECEIVED` no correlacionados a compras reales.
2. ✅ **COMPLETADO 2026-05-04** — Cloud Scheduler `rifa-cleanup` (us-east1) corre cada 5 min con `*/5 * * * *` (TZ Buenos Aires). POST a `/api/cron/cleanup` con `Authorization: Bearer <CRON_SECRET>`. Endpoint protegido (sin auth → 401, auth correcta → 200, auth incorrecta → 401). Secret `cron-secret` en Secret Manager, expuesto a Cloud Run como env var `CRON_SECRET`. Validado end-to-end: run manual disparó log `Cleanup completed: { releasedNumbers: 0, cancelledPurchases: 0 }` en revision `00009-mvp`.

**Próximo: Fase 4 — Lanzamiento**.

**Después: Fase 4** — 4.1 (deploy con config 2026, ya en prod), 4.2 (smoke E2E con compra real de 1 número, cumple las skipped 1.5/1.6), 4.3 (anuncio), 4.4 (monitoreo 24h).

**Fase 3 (mejoras: auth admin, email post-compra, exportes, backup BD)** queda postergada post-lanzamiento.

### Plan de la próxima sesión (Fases 2 → 4 al hilo)

> Las tareas 1.5 (smoke sandbox MP) y 1.6 (concurrency tests post-fix BUG-008) quedan SKIPPED conscientemente — recomendado hacerlas como gate antes del lanzamiento real (Fase 4.2 Smoke E2E con compra de prueba ya cumple ese rol con monto bajo).

**Fase 2 — Configuración de la nueva rifa 2026**:
1. **2.1**: definir parámetros con el usuario (total de números, precio, fecha sorteo, premios). Decisión de diseño a documentar en MEMORIA.md.
2. **2.2**: reset de la BD productiva — borrar `purchases`, `purchase_numbers`, `event_logs` de la rifa 2025. Mantener tabla `raffles` y `raffle_numbers` solo para reescribirlas en 2.3-2.4. Hacer backup previo (export a JSON local).
3. **2.3**: insert nuevo registro en `raffles` con la config decidida en 2.1.
4. **2.4**: re-poblar `raffle_numbers` (todos en `available`) según `totalNumbers`. Pasar por `db-migration-reviewer` antes de ejecutar.
5. **2.5**: smoke test UI — abrir https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/ y verificar que la grilla muestra los números nuevos en verde.

**Pre-requisito antes de Fase 4 (acción de seguridad)**:
- **Regenerar `MERCADO_PAGO_WEBHOOK_SECRET`** porque fue expuesto en chat durante diagnóstico BUG-008. MP dashboard → "Generar nueva clave secreta" → `gcloud secrets versions add mp-webhook-secret --data-file=-` → `./scripts/deploy.sh`.
- **Configurar Cloud Scheduler** para invocar `/api/cron/cleanup` cada 5 min (Vercel cron auto se perdió en la migración a Cloud Run).

**Fase 4 — Lanzamiento**:
1. **4.1**: deploy a producción con configuración 2026 (probablemente solo redeploy, ya estamos en prod).
2. **4.2**: smoke test E2E con compra real de prueba (1 número, monto bajo) — esta tarea cumple también como validación 1.5 + 1.6.
3. **4.3**: anuncio del lanzamiento al colegio.
4. **4.4**: monitoreo activo primeras 24h (logs Cloud Run, eventLogs Turso, MP dashboard).

**Tarea Fase 3** (postergable post-lanzamiento): autenticación admin (3.1), email post-compra (3.2), exportes admin (3.3-3.5), backup BD (3.6).
