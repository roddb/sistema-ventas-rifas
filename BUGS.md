# Registro de Bugs y Correcciones

## Proyecto: Sistema de Ventas de Rifas Escolares
## Iniciado: 2025-09-11
## Última actualización: 2026-05-04

---

## Resumen
- **Total bugs registrados**: 9
- **Resueltos**: 9
- **Pendientes**: 0

> Histórico migrado desde `old_docs/Historial.md` (sesión inaugural 2025-09-11). A partir de la reactivación 2026-05-01, los nuevos bugs se numeran BUG-006+.

---

## Registro Detallado

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

## Nota sobre la reactivación 2026

Al reactivar el proyecto en mayo 2026 (8 meses de pausa) hay que validar que ninguno de los 5 bugs históricos haya regresado. Checklist sugerido para la primera sesión post-reactivación:

1. **Anti-BUG-H001**: cargar la app, hacer una compra de prueba en sandbox MP, verificar que la grilla refleja el cambio dentro de 30s
2. **Anti-BUG-H002**: confirmar que `SELECT COUNT(*) FROM raffle_numbers WHERE status='sold' AND purchaseId IS NULL` da 0
3. **Anti-BUG-H003**: `npm run build` sin errores TypeScript
4. **Anti-BUG-H004**: `vercel env ls` muestra las 5 env vars críticas en Production y Preview
5. **Anti-BUG-H005**: smoke test manual del header

Si alguno regresa, abrir como BUG-006+ con descripción + causa + solución.
