# Registro de Bugs y Correcciones

## Proyecto: Sistema de Ventas de Rifas Escolares
## Iniciado: 2025-09-11
## Última actualización: 2026-05-06

---

## Resumen
- **Total bugs registrados**: 13
- **Resueltos**: 13
- **Pendientes**: 0

> Histórico migrado desde `old_docs/Historial.md` (sesión inaugural 2025-09-11). A partir de la reactivación 2026-05-01, los nuevos bugs se numeran BUG-006+.

---

## Registro Detallado

### BUG-013 | RESUELTO
- **Fecha detectado**: 2026-05-06 (Fase 7.D pre-deploy, run 1/3 de concurrency tests)
- **Fecha resuelto**: 2026-05-06
- **Descripción**: 3 INSERTs a `event_logs` violaban FK `purchase_id REFERENCES purchases(id)` cuando el valor pasado era un `COM-xxx` (existe en `combo_purchases`, NO en `purchases`). Como `PRAGMA foreign_keys=1` en Turso, todo INSERT con purchaseId combo fallaba con `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`. Cualquier compra cross-product (rifa + combos) devolvía 500 con rollback total — ni order ni purchase ni nada se creaba.
- **Contexto**: descubierto en run 1/3 del gate concurrency tests pre-deploy 7.D. Scenarios 1 y 4 (que usan combos) fallaron con `status=500 error="Internal error"`. Scenarios solo-rifa (User C scenario 4 sin combos) pasaron. El concurrency-validator había advertido "review estático insuficiente per CLAUDE.md, gate de 7.D = correr 3x runs" — y el primer run capturó el bug.
- **Error/Síntoma**: dev server logs `[POST /api/order/purchase] LibsqlError: SQLITE_CONSTRAINT: SQLite error: FOREIGN KEY constraint failed at orderService.ts:132`.
- **Causa raíz**: Schema declara `event_logs.purchase_id TEXT REFERENCES purchases(id)` solo (no a `combo_purchases`). Pero el código en 3 lugares insertaba un `COM-xxx` en ese campo: (1) `orderService.ts:159 COMBO_PURCHASE_CREATED`, (2) `orderService.ts:235 ORDER_CANCEL_CHILD_RACE` (rama combo), (3) `webhooks/mercadopago/route.ts:174 LEGACY_COM_WEBHOOK_IGNORED`. En Fase 6 funcionó porque la columna `event_logs.order_id` no existía aún y el FK enforcement era solo sobre purchases — pero al introducir `orders` en Fase 7 con FK enforcement activo, los inserts buggy quedaron expuestos.
- **Solución aplicada**: pasar `purchaseId: null` y mover el `comboChildId` o `legacyRef` al campo `data` JSON del eventLog. Auditoría preservada via `order_id` (otra FK válida) o el contenido del data JSON. Ningún consumer filtra `event_logs` por `purchase_id` (verificado con grep), así que el cambio no rompe queries existentes. Fix aplicado en commit `d2033e4` (orderService.ts:161 + 238 + webhooks COM-) y completado en `8490eb9` para PUR- legacy (mismo patrón, prevención post-auditoría).
- **Archivos afectados**: `lib/services/orderService.ts:161`, `lib/services/orderService.ts:238`, `app/api/webhooks/mercadopago/route.ts:166` y `:174`.
- **Aprendizaje**: cuando una columna tiene FK a una tabla pero la realidad de negocio puede involucrar IDs de OTRA tabla con prefijo distinto (`PUR-` vs `COM-`), el patrón seguro es `null` + ID semántico en el `data` JSON. Alternativamente agregar columna paralela con FK a la otra tabla, pero eso requiere migration. **Regla operativa**: si vas a insertar un valor en una columna FK, verificá que ese valor existe en la tabla referenciada O pasá `null`.

---

### BUG-012 | RESUELTO
- **Fecha detectado**: 2026-05-06 (post-deploy Fase 7.D, durante inspección de un order pendiente real esperando 15min de cron timeout)
- **Fecha resuelto**: 2026-05-06 (mismo día, fix propagado en 2 commits)
- **Descripción**: La columna `created_at` (declarada en schema como `integer('created_at', { mode: 'timestamp' }).default(sql\`CURRENT_TIMESTAMP\`)`) se guardaba como **TEXT** ISO format `"2026-05-06 21:56:58"` en vez de **integer unix epoch** porque `CURRENT_TIMESTAMP` en SQLite devuelve string. Drizzle solo convierte `Date → integer` cuando recibe explícitamente un `new Date()` en el INSERT — los defaults SQL pasan de largo. Resultado: el cron `releaseExpiredOrders` filtra con `lte(orders.createdAt, fifteenMinutesAgo)` (donde `fifteenMinutesAgo` es un integer unix epoch), comparando string vs integer → **nunca matchea**. Ningún order pending se libera por timeout. Los números quedan reservados eternamente.
- **Contexto**: post-deploy 7.D (revision 00015-bzb). Una compra de prueba real (Rodrigo intentando con su propia cuenta, bloqueado por seller=buyer) creó un order pending con 3 nums reservados a las 21:56. A las 22:35 (39 min después, cron corrió 5+ veces cada 5min), el order seguía pending y los nums seguían reserved. El usuario sospechó "ya pasaron 10 min, debería haberse limpiado". Inspección de logs reveló cron con `cancelled: 0` cada vez. Inspección de la BD mostró `typeof(created_at) = text` y `(strftime('%s','now') - created_at)/60 = 29635084` (valor absurdo, confirmó string-vs-integer mismatch).
- **Error/Síntoma**: queries `SELECT typeof(created_at) FROM orders WHERE id='ORD-...'` devolvían `'text'`. `gcloud run services logs` mostraba `Cleanup completed: { cancelled: 0, releasedNumbers: 0 }` cada 5min indefinidamente para orders que claramente tenían >15min.
- **Causa raíz**: `sql\`CURRENT_TIMESTAMP\`` en SQLite/libsql devuelve string ISO `"YYYY-MM-DD HH:MM:SS"`. El modo `{ mode: 'timestamp' }` de Drizzle solo aplica al lado JS (auto-convierte Date ↔ integer) cuando vos pasás un valor desde tu código. NO afecta lo que hace el motor SQL al evaluar el DEFAULT. Por eso INSERTs sin `createdAt` explícito caen al default SQL string. **Por qué no se detectó pre-deploy**: los concurrency tests usan `/api/order/cancel` explícito (no esperan timeout). El Scenario 2 manual del gate funcionó porque `UPDATE orders SET created_at = strftime('%s','now') - 1000` escribe un INTEGER explícito — exactamente la diferencia que oculta el bug. Solo se descubre con un order pending real esperando que el cron lo limpie.
- **Impacto real**: catastrófico para producción. Un comprador que abandona el carrito tras crear un order pero antes de pagar → sus números se quedan reservados forever, sin posibilidad de que otro user los compre. La rifa eventualmente se llenaría de zombies y los números quedarían bloqueados. Inaceptable para venta real.
- **Solución aplicada**: pasar `createdAt: new Date(), updatedAt: new Date()` explícito en TODOS los INSERTs persistentes. Drizzle convierte Date → integer unix epoch automáticamente. Sin esto, el default SQL gana y guarda string.
  - **Commit `34d111c`** (fix mínimo crítico): 5 INSERTs en `orderService.createOrder` (orders, purchases, purchase_numbers, combo_purchases, combo_purchase_items). Validado E2E: order creado tras fix → `typeof(created_at)='integer'` → backdate via UPDATE → cron cleanup `{ cancelled: 1, releasedNumbers: 2 }`.
  - **Commit `8490eb9`** (fix completo I-3 post-auditoría): los 12 INSERTs restantes a `event_logs` en `orderService.ts` + 3 en `webhooks/mercadopago/route.ts`. Aunque event_logs no se filtra por edad hoy, dashboards/reportes temporales futuros romperían si quedaban como TEXT. 172 rows pre-fix con typeof=text quedaron como deuda histórica (no bloquea operación nueva).
- **Archivos afectados**: `lib/services/orderService.ts` (17 INSERTs en total fixeados), `app/api/webhooks/mercadopago/route.ts` (3 INSERTs).
- **Aprendizaje**: en Drizzle ORM con SQLite/Turso, NUNCA confiar en `default(sql\`CURRENT_TIMESTAMP\`)` para columnas declaradas como `integer({ mode: 'timestamp' })`. Pasar `createdAt: new Date()` explícito en cada INSERT. Alternativa más robusta: cambiar el default a `default(sql\`(unixepoch())\`)` que devuelve integer (SQLite ≥3.38, Turso lo soporta) — pero requiere migration de schema. **Regla promovible a CLAUDE.md**: "todo `db.insert` o `tx.insert` a una tabla con `mode:'timestamp'` DEBE pasar `createdAt: new Date()` explícito; el default SQL guarda TEXT y rompe queries de filtro temporal".

---

### BUG-011 | RESUELTO
- **Fecha detectado**: 2026-05-05 (durante deploy de Fase 5.D paso (d))
- **Fecha resuelto**: 2026-05-05
- **Descripción**: `scripts/deploy.sh` no preservaba `CRON_SECRET` en el `--set-secrets` del comando `gcloud run deploy`. Como `--set-secrets` reemplaza la lista completa (no merge incremental), cualquier deploy posterior a la configuración inicial de Cloud Scheduler perdía el `CRON_SECRET` env var. El handler `/api/cron/cleanup` tiene la lógica `if (cronSecret && req.headers.authorization === ...)` — sin la env var, la validación se saltea y el endpoint queda **fail-open** a internet.
- **Contexto**: Cloud Scheduler `rifa-cleanup` se configuró el 2026-05-04 (gate pre-Fase 4) agregando `CRON_SECRET` al servicio Cloud Run vía `gcloud run services update --update-secrets`. Eso resultó en revision `00009-mvp` con CRON_SECRET correctamente seteado. **Pero los deploys siguientes** (revisions `00010-jlz`, `00011-jdr`, `00012-xrl`) usaron `./scripts/deploy.sh` que tenía `--set-secrets` sin CRON_SECRET → la env var se perdió en cada uno → desde el 2026-05-04 al 2026-05-05, el endpoint cron estuvo abierto a internet sin auth.
- **Error/Síntoma**: `gcloud run services describe sistema-ventas-rifas --format='value(spec.template.spec.containers[0].env[].name)'` no listaba `CRON_SECRET` en revisions 00010/00011/00012. Endpoint `POST /api/cron/cleanup` sin Authorization header devolvía 200 (procesaba el cleanup) en vez de 401.
- **Causa raíz**: El comando `gcloud run deploy --set-secrets=...` reemplaza la lista completa de secrets (no merge). Cualquier secret no listado se borra del servicio. El setup original de Cloud Scheduler usó `--update-secrets` (que sí mergea), generando una asimetría entre setup inicial y deploys posteriores.
- **Impacto real**: bajo (Cloud Scheduler seguía mandando el bearer correctamente, así que el cron job en sí funcionaba; pero alguien externo podía haber spammeado el endpoint para liberar reservas — reservas no había, así que no pasó nada). **Riesgo de seguridad**: alto si alguien había escaneado el endpoint.
- **Solución aplicada**: Editar `scripts/deploy.sh` agregando `CRON_SECRET=cron-secret:latest` al `--set-secrets` (commit `b50abc0`). Verificación post-deploy revision `00013-529`: env var listada en `gcloud run services describe`, endpoint sin auth devuelve 401 correctamente. Validado nuevamente en revision `00014-9wz`.
- **Archivos afectados**: `scripts/deploy.sh` (líneas comentario + `--set-secrets`)
- **Aprendizaje**: comandos `gcloud run` con flags como `--set-secrets`, `--set-env-vars` reemplazan listas; `--update-*` mergean. Si un proyecto mezcla los dos en distintos momentos del ciclo, queda una bomba latente. **Regla operativa**: cualquier secret/env crítico que esté en el servicio Cloud Run debe estar TAMBIÉN en `scripts/deploy.sh` para que no se pierda en deploys.

---

### BUG-H001 | RESUELTO
- **Fecha detectado**: 2025-09-11
- **Descripción**: Desincronización completa BD ↔ frontend. Los números marcados como vendidos en la BD no se reflejaban en la grilla; tras una compra simulada, los números seguían apareciendo verdes
- **Contexto**: Sesión inaugural — primer ciclo end-to-end del flujo de compra
- **Error/Síntoma**: Comprabas el número 50, la BD lo registraba como `sold`, la grilla seguía mostrándolo `available`
- **Causa raíz**: Múltiples capas: (1) Next.js cacheaba estáticamente las API routes, (2) `localStorage` persistía el estado anterior de purchases, (3) hardcodeo de `PRICE_PER_NUMBER = 500` cuando la BD tenía $2.000
- **Solución aplicada**:
  - `export const dynamic = 'force-dynamic'` y `export const revalidate = 0` en TODAS las API routes que tocan BD
  - Headers `no-cache, no-store, must-revalidate` en respuestas
  - Migración de `useLocalStorage` → `useState` con fetch en mount + polling 30s
  - Eliminación de constantes hardcodeadas, lectura de `/api/raffle/config`
- **Archivos afectados**: `app/api/numbers/route.ts`, `app/api/purchase/route.ts`, `components/RifasApp.tsx`, `app/api/raffle/config/route.ts` (nuevo)
- **Fecha resuelto**: 2025-09-11

---

### BUG-H002 | RESUELTO
- **Fecha detectado**: 2025-09-11
- **Descripción**: Inconsistencia en BD — había números marcados como vendidos sin `purchase` ni `purchase_numbers` asociados
- **Contexto**: Auditoría de la BD durante el debug del BUG-H001
- **Error/Síntoma**: `SELECT * FROM raffle_numbers WHERE status='sold'` devolvía filas, pero `SELECT * FROM purchases` y `SELECT * FROM purchase_numbers` estaban vacías
- **Causa raíz**: El usuario había editado `raffle_numbers` directamente desde Turso Studio para hacer pruebas, sin crear los registros relacionados en `purchases` y `purchase_numbers`
- **Solución aplicada**: Reset completo de la BD (delete de las 3 tablas), confirmación de la convención: cualquier intervención manual debe pasar por una transacción que toque las 3 tablas o por `raffleService`
- **Archivos afectados**: BD productiva (sin código)
- **Fecha resuelto**: 2025-09-11

---

### BUG-H003 | RESUELTO
- **Fecha detectado**: 2025-09-11
- **Descripción**: Webhook MercadoPago lanzaba TypeScript error "expected 1 argument, got 2"
- **Contexto**: Integración inicial de MercadoPago, primer deploy a Vercel falló por TS strict
- **Error/Síntoma**: `Build failed — Argument of type X is not assignable...` en `/api/webhooks/mercadopago/route.ts`
- **Causa raíz**: Refactor durante la integración pasó un argumento extra a una función helper
- **Solución aplicada**: Eliminado el argumento extra, simplificada la signature de la función
- **Archivos afectados**: `app/api/webhooks/mercadopago/route.ts`
- **Fecha resuelto**: 2025-09-11

---

### BUG-H004 | RESUELTO
- **Fecha detectado**: 2025-09-11
- **Descripción**: Variables de entorno de MercadoPago faltantes en Vercel — la app deployada no podía crear preferences
- **Contexto**: Primer deploy a producción tras la integración MP
- **Error/Síntoma**: `Error: MercadoPago access token not configured` en logs de Vercel
- **Causa raíz**: Las env vars estaban en `.env.local` pero no se sincronizan automáticamente a Vercel; hay que cargarlas explícitamente en el dashboard
- **Solución aplicada**: Carga manual de `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET` y `NEXT_PUBLIC_BASE_URL` en Vercel Project Settings → Environment Variables
- **Archivos afectados**: ninguno (configuración de Vercel)
- **Fecha resuelto**: 2025-09-11

---

### BUG-H005 | RESUELTO
- **Fecha detectado**: 2025-09-11
- **Descripción**: TypeScript build error al hacer header clickeable
- **Contexto**: Mejora UX — header debía recargar la página al hacer click
- **Error/Síntoma**: TS strict rechazaba el handler por tipos
- **Causa raíz**: Implementación inicial intentaba usar router de Next; se simplificó a `window.location.reload()`
- **Solución aplicada**: Click handler simplificado a `() => window.location.reload()`
- **Archivos afectados**: `components/RifasApp.tsx`
- **Fecha resuelto**: 2025-09-11

---

### BUG-006 | RESUELTO
- **Fecha detectado**: 2026-05-01
- **Descripción**: Working tree del proyecto contenía dos archivos con datos productivos sin trackear (`ventas_rifas_completo_2025.csv` con PII real de compradores: nombres, emails, teléfonos; `numeros_disponibles_venta.txt`). Sin `.gitignore` apropiado, el primer `git add -A` los habría empujado a un repo público.
- **Contexto**: Primer `/save` post-reactivación; al inspeccionar el working tree antes del commit aparecieron como untracked
- **Error/Síntoma**: `git status` mostraba ambos archivos como `??` (untracked, candidatos a commit)
- **Causa raíz**: Archivos generados como exports de la rifa 2025 (probablemente del panel admin o de queries manuales a Turso) que quedaron en el directorio del proyecto. El `.gitignore` original solo cubría node_modules, .env*, .next, y artefactos típicos — no había patrón para data exports.
- **Solución aplicada**: Agregado al `.gitignore` el patrón `*.csv` y entrada explícita para `numeros_disponibles_venta.txt` antes de cualquier commit. `git status` confirma que ya no aparecen.
- **Archivos afectados**: `.gitignore`
- **Fecha resuelto**: 2026-05-01

---

### BUG-007 | RESUELTO
- **Fecha detectado**: 2026-05-01
- **Descripción**: Workspace de Vercel `rodrigodibernardo-gmailcoms-projects` quedó en estado `Paused`; el proyecto `sistema-ventas-rifas` fue eliminado del workspace. La URL pública `sistema-ventas-rifas.vercel.app` devolvió HTTP 404 con `x-vercel-error: DEPLOYMENT_NOT_FOUND`.
- **Contexto**: Sesión de reactivación 2026-05-01, intento de verificar deploy productivo (tarea 1.4).
- **Error/Síntoma**: Sitio caído. Dashboard Vercel muestra badge "Paused" en el workspace, "Upgrade to resume service" como única acción ofrecida. No hay botón "Resume" / "Unpause".
- **Causa raíz**: Hipótesis dominante — detección automática de uso comercial. Vercel endureció en 2024-2026 la cláusula "no commercial use" del plan Hobby; una rifa con MercadoPago integrado y operación 2025 con $4M ARS proyectados encajó en el flag. Caps de uso descartados; sin invoices pendientes; Speed Insights activado en Hobby (que requiere Pro) probablemente fue disparador secundario.
- **Solución aplicada**: Migración completa a Google Cloud Run en us-east1 bajo cuenta `intellego.ok@gmail.com` (proyecto nuevo `sistema-ventas-rifas-prod`). Mantiene 100% Free Tier. Documentado en `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`.
- **Archivos afectados**: `next.config.js`, nuevos `Dockerfile`, `.dockerignore`, `scripts/deploy.sh`, `public/.gitkeep`. Renombrado `.claude/commands/deploy-vercel.md` → `.claude/commands/deploy.md`.
- **Fecha resuelto**: 2026-05-02

---

### BUG-008 | RESUELTO
- **Fecha detectado**: 2026-05-02 (durante cutover MP de migración Cloud Run, Task 9)
- **Fecha resuelto**: 2026-05-02
- **Descripción inicial**: El handler `app/api/webhooks/mercadopago/route.ts` aceptaba webhooks con firma HMAC inválida y devolvía HTTP 200.
- **Diagnóstico expandido**: bajo el síntoma visible había 7 sub-bugs encadenados. 6 fueron identificados por `diagnosis-specialist` antes de implementar; el séptimo (008-G) salió solo durante validación E2E porque requería tráfico real de MP para reproducirse.
  - **008 base**: `return NextResponse.json({error:'Invalid signature'}, {status:401})` comentado desde commit inicial 2025-09-11 (`437776e4`). Era "temporal para testing" y nunca se restauró.
  - **008-A** (más grave): manifest HMAC mal construido. Código generaba `<paymentId>.<ts>` cuando MP exige `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. **Ninguna firma válida hubiera matcheado nunca** incluso con secret correcto.
  - **008-B**: parseo del header `x-signature` por posición (`parts[0]`, `parts[1]`) en vez de por nombre. Frágil ante cambios de orden o campos extra.
  - **008-C**: `crypto.timingSafeEqual` lanza excepción con buffers de longitudes distintas; el catch externo la tragaba y devolvía 200.
  - **008-D**: bypass por header faltante — `if (!signature) return false` combinado con return 401 comentado dejaba que cualquier POST sin `x-signature` fuera procesado.
  - **008-E**: `RaffleService.confirmPayment` no era idempotente. MP retries (3 en ~22 min) sobreescribían `soldAt` y duplicaban event logs.
  - **008-F**: el catch externo del POST devolvía 200 incluso en errores transitorios. Comentario decía "para evitar reintentos" — anti-patrón: descartaba la red de seguridad de IPN.
  - **008-G** (descubierto en E2E Task 5): el `ts` del header `x-signature` viene de MP en **milisegundos** (epoch ms, 13 dígitos), no en segundos. El código asumía segundos en `Math.abs(now - ts) > 600`, lo cual rechazaba TODAS las firmas legítimas con `skew sec: -1.7×10¹²`. Debug logs revelaron `ts header: 1777861637614` cuando la simulación MP llegó al endpoint. Fix: detectar formato (ts > 1e11 = ms) y normalizar a segundos solo para validación de ventana, manteniendo el ts original (string) en el manifest porque ese es el valor que MP firma.
- **Causa raíz**: implementación inicial del webhook (commit `437776e4`, 2025-09-11) usó un manifest simplificado para hacer pruebas rápidas en sandbox y nunca se reemplazó por el formato oficial. La rifa 2025 corrió con este bug; mitigación implícita fue que `getPaymentInfo(paymentId)` contra MP API filtraba IDs falsos por `external_reference`.
- **Causa raíz secundaria (008-G)**: la doc oficial de MP no especifica claramente el formato del ts en el header (algunos ejemplos lo muestran en segundos, otros en ms). Solo se descubre con tráfico real.
- **Solución aplicada**:
  - Nuevo módulo `lib/webhook-verification.ts` con manifest oficial + parseo robusto + validación de timestamp con normalización ms→sec + replay protection (MAX_TIMESTAMP_AGE_SECONDS=600).
  - 15 tests unitarios con `node:test` built-in en `tests/webhook-verification.test.mjs` (incluye 2 casos para format ms y replay con ms).
  - Handler `app/api/webhooks/mercadopago/route.ts` reescrito: rechaza con 400 si falta `body.data.id`, 401 si firma inválida o secret no configurado, 503 en errores transitorios (habilita retries de MP).
  - `RaffleService.confirmPayment` y `cancelPayment` ahora atómicos en `db.transaction()` con locks optimistas (WHERE paymentStatus='pending' / status='reserved') + idempotencia (return early si ya 'approved').
  - `releaseExpiredReservations` con guards en UPDATE raffleNumbers (status='reserved') y UPDATE purchases (paymentStatus='pending') para no pisar estados confirmados.
  - Log `PAYMENT_CONFLICT` en eventLogs (fuera de tx) cuando hay race detectada.
- **Validación**:
  - 15 tests unitarios pasan.
  - 4 tests E2E pasan (sin firma → 401, sin data.id → 400, firma forjada → 401, simulación dashboard MP → "Webhook signature verified successfully" + 503 por id ficticio = comportamiento correcto).
  - `npm run lint && npm run build` verdes.
- **Archivos afectados**: `lib/webhook-verification.ts` (nuevo), `tests/webhook-verification.test.mjs` (nuevo), `tests/run-tests.sh` (nuevo), `app/api/webhooks/mercadopago/route.ts`, `lib/services/raffleService.ts:347+` (confirmPayment + cancelPayment + releaseExpiredReservations), `package.json`.
- **Auditoría retroactiva pendiente**: query a `event_logs` 2025 para detectar webhooks procesados sin firma válida. **Tarea separada**, no crítica (MP API filtró IDs falsos por external_reference).
- **Acción de seguridad pendiente**: el `MERCADO_PAGO_WEBHOOK_SECRET` fue pegado completo en chat durante diagnóstico Task 4. Recomendado regenerar el secret en MP dashboard, actualizarlo en GCP Secret Manager (`gcloud secrets versions add mp-webhook-secret`) y redeployar antes de Fase 4.

---

### BUG-009 | RESUELTO
- **Fecha detectado**: 2026-05-04 (smoke test UI Fase 2.5 inmediatamente después de `VENTAS_CERRADAS=true → false`)
- **Fecha resuelto**: 2026-05-04
- **Descripción**: La grilla de números quedaba colgada en "Cargando números..." indefinidamente al cargar la home productiva, aunque el chip lateral mostraba correctamente "2.000 disponibles". Estado `loading` permanentemente en `true`.
- **Contexto**: Tras cambiar la constante hardcoded `VENTAS_CERRADAS = true` → `false` para reactivar la grilla con la rifa 2026, apareció el bug. El cambio destapó un bug latente de 8 meses.
- **Error/Síntoma**: UI muestra spinner "Cargando números..." en el componente `NumberGrid`, mientras que `numbers` array está poblado con 2.000 entradas (lo confirmaba el chip "✓ 2000 disponibles"). Auto-refresh disparándose en bucle (visible en console.log "Auto-refreshing numbers..." cada cientos de ms).
- **Causa raíz**: Loop infinito en `useEffect` de `RifasApp.tsx:600-629`. Las deps eran `[loadNumbers, selectedNumbers, currentStep, getNumberStatus]`. `getNumberStatus` es `useCallback` con dep `[numbers, selectedNumbers]`. Flujo del loop:
  1. `loadNumbers()` setea `numbers` (estado)
  2. `numbers` cambia → `getNumberStatus` se recrea (nueva referencia)
  3. `getNumberStatus` cambia → el `useEffect` re-corre por su dep array
  4. Re-corrida llama `loadNumbers()` de nuevo → goto 1
  
  El estado `loading` quedaba constantemente en `true` porque `setLoading(true)` se llamaba al inicio de cada `loadNumbers()` antes de que el `setLoading(false)` del finally anterior se reflejara en render.
- **Por qué no se detectó antes**: el componente `NumberGrid` tiene un `if (VENTAS_CERRADAS) return <pantalla de "Gracias por participar"/>` ANTES del check `if (loading)`. Con `VENTAS_CERRADAS=true` durante toda la rifa 2025 y los 8 meses de pausa, la rama del bug nunca se ejecutaba en runtime. Las warnings de ESLint (`react-hooks/exhaustive-deps`) en líneas 629/665/683 estaban presentes pero asumidas como pre-existentes inocuas.
- **Solución aplicada**: separar el `useEffect` en dos:
  - **Polling**: dep única `[loadNumbers]` (estable, `useCallback` con `[]`). Solo carga inicial + `setInterval` cada 10s.
  - **Validación de selección**: deps reactivas `[numbers, selectedNumbers, currentStep, getNumberStatus, setError, setSelectedNumbers]`. Solo verifica que los seleccionados sigan disponibles cuando cambian; no llama `loadNumbers`.
  
  Esta separación rompe el ciclo: cambios en `numbers` ya no reinician el polling.
- **Validación**: `npm run lint` pasa (warning del effect 629 desapareció), `npm run build` verde, deploy revision `00008-bg2`, smoke UI confirma grilla renderizando 2.000 números.
- **Archivos afectados**: `components/RifasApp.tsx` (2 cambios: split del useEffect; cambio simultáneo de `VENTAS_CERRADAS` y title hardcoded en la misma sesión, no atribuibles a este bug pero deployados juntos).
- **Deuda técnica residual**: `VENTAS_CERRADAS` sigue siendo constante hardcoded a nivel módulo. Lo correcto sería derivarlo de `raffleConfig.isActive` (la BD ya tiene `is_active=true` para la rifa 2026, y `is_active=false` cerraría las ventas sin redeploy). Pendiente para una próxima iteración.

---

### BUG-010 | RESUELTO
- **Fecha detectado**: 2026-05-04 (compra real de Romina Ruiz de Albornoz, 2do intento productivo tras Fase 4.1)
- **Fecha resuelto**: 2026-05-04
- **Descripción**: Compradores reales recibían "Algo salió mal · Código CPT01-…" al hacer click en "Pagar" en MercadoPago. CPT01 es el código de error genérico de Checkout Pro de MP. Reproducible en cada intento, con distintos buyers y distintos métodos de pago.
- **Contexto**: Romi (segunda buyer real, tras intento bloqueado de Rodrigo por seller=buyer) intentó pagar dos veces con dinero disponible y recibió CPT01 ambas. Tres purchases creadas en BD quedaron en `pending` con números 1 y 2 reservados en limbo. Pre-Fase 4.3 (anuncio).
- **Error/Síntoma**: en MP UI: "Algo salió mal · Código CPT01-{random}". En BD: purchases creadas con `mercado_pago_preference_id` poblado pero sin webhook de pago. Cloud Run logs: `/api/preference` devolvía 200 + `init_point` correcto, pero MP rechazaba al iniciar el cobro.
- **Causa raíz**: `next.config.js` tenía bloque `env: { NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000' }`. Ese campo `env` en next.config.js **fuerza a Next.js a inlinear el valor en build time** en TODO el bundle (incluso server code), pisando el comportamiento normal de runtime para variables `NEXT_PUBLIC_*`. El Docker `RUN npm run build` no recibe `NEXT_PUBLIC_BASE_URL` (no se setea en Dockerfile), así que cae al fallback `'http://localhost:3000'` y queda **hardcoded en el JS compilado** dentro del container. La env var de runtime en Cloud Run estaba bien seteada (`https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app`) pero el código compilado nunca la leía. Las preferences creadas en MP tenían `back_urls={success:"",failure:"",pending:""}` (MP descarta URLs localhost) y `notification_url="http://localhost:3000/api/webhooks/mercadopago"`. MP rechazaba al iniciar el cobro porque las back_urls quedaban vacías. La cuenta MP estaba 100% OK (verificado vía `GET /users/me`).
- **Por qué los smoke tests no lo detectaron**: los 5 tests automatizados de Fase 4.2 (sin user action) sólo validaban que `/api/preference` devolviera `200 + initPoint`. NO inspeccionaban las URLs internas del preference creado. Los tests E2E del fix BUG-008 pasaban porque la simulación dashboard MP usa la URL configurada en el panel (correcta, Cloud Run), no la del payload de la preference.
- **Cómo se diagnosticó**: con `gcloud secrets versions access latest --secret=mp-access-token` + `curl` a `/users/me` (cuenta OK) + `curl` a `/checkout/preferences/{id}` revelando las URLs vacías y localhost. De ahí se buscó qué hardcodeaba `localhost:3000` en el código → grep en repo encontró el bloque `env` en `next.config.js`.
- **Solución aplicada**: removido el bloque `env: { NEXT_PUBLIC_BASE_URL: ... }` de `next.config.js`. Ahora `process.env.NEXT_PUBLIC_BASE_URL` se lee runtime desde la env var de Cloud Run sin inline. Validación: smoke test post-deploy con curl + MP API confirmó back_urls y notification_url con dominio Cloud Run. Compra real de Romi (`PUR-bv13rkdfQQ`, $2.000, approved) cerró la cadena end-to-end minutos después.
- **Cleanup BD asociado**: 3 purchases pending de Romi + 1 purchase pending de Rodrigo + 1 purchase del smoke bot todas pasaron a `cancelled`; números 1 y 2 liberados a `available`; `purchase_numbers` correspondientes borradas. Todas las escrituras con guard `WHERE status='reserved' AND purchase_id=...` y `payment_status='pending'`.
- **Archivos afectados**: `next.config.js` (bloque env removido), `lib/mercadopago.ts` (cambio bonus de título 2025→2026 que se hizo en el mismo deploy).
- **Deploys**: revision `sistema-ventas-rifas-00011-jdr` (fix título) y `sistema-ventas-rifas-00012-xrl` (fix BUG-010).
- **Aprendizaje promovido**: en CLAUDE.md / LEARNINGS — el bloque `env` en `next.config.js` debe evitarse para variables que pueden ser undefined en build time porque su fallback queda hardcoded forever. Para variables server-only que dependen del entorno (URLs, secrets), no usar prefijo `NEXT_PUBLIC_` y no incluir en bloque `env`. Y siempre que se valide un flujo de pago, inspeccionar la preference creada vía MP API, no sólo confirmar que el endpoint devolvió 200.

---

## Nota sobre la reactivación 2026

Al reactivar el proyecto en mayo 2026 (8 meses de pausa) hay que validar que ninguno de los 5 bugs históricos haya regresado. Checklist sugerido para la primera sesión post-reactivación:

1. **Anti-BUG-H001**: cargar la app, hacer una compra de prueba en sandbox MP, verificar que la grilla refleja el cambio dentro de 30s
2. **Anti-BUG-H002**: confirmar que `SELECT COUNT(*) FROM raffle_numbers WHERE status='sold' AND purchaseId IS NULL` da 0
3. **Anti-BUG-H003**: `npm run build` sin errores TypeScript
4. **Anti-BUG-H004**: `vercel env ls` muestra las 5 env vars críticas en Production y Preview
5. **Anti-BUG-H005**: smoke test manual del header

Si alguno regresa, abrir como BUG-006+ con descripción + causa + solución.
