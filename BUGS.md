# Registro de Bugs y Correcciones

## Proyecto: Sistema de Ventas de Rifas Escolares
## Iniciado: 2025-09-11
## Última actualización: 2026-05-01

---

## Resumen
- **Total bugs registrados**: 8
- **Resueltos**: 7
- **Pendientes**: 1

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

### BUG-008 | PENDIENTE
- **Fecha detectado**: 2026-05-02 (durante cutover MP de migración Cloud Run, Task 9)
- **Descripción**: El handler `app/api/webhooks/mercadopago/route.ts` línea ~64 tiene comentado el `return NextResponse.json({error:'Invalid signature'}, {status:401})`. Cuando la firma HMAC del webhook no valida, el handler **logea "Invalid webhook signature"** pero **igualmente procesa el body con HTTP 200**.
- **Contexto**: Detectado al ejecutar "Simular notificación" desde MP dashboard contra el nuevo endpoint en Cloud Run. La simulación retornó 200 y los logs mostraron `Invalid webhook signature` seguido por procesamiento normal del payload (intentó fetch del payment, falló con "not found" porque el ID era falso).
- **Severidad**: ALTA. Cualquier atacante puede mandar POST forjado a `/api/webhooks/mercadopago` y el handler lo aceptará. La única defensa hoy es el fetch posterior a la API real de MP, pero si el atacante usa un ID válido (ej. de transacción real con otro merchant), podría manipular `purchases.status`.
- **Causa raíz**: Código preexistente desde 2025. Alguien comentó el return 401 para debugging y nunca lo restauró. La migración a Cloud Run NO introdujo el bug, solo lo expuso al revisar logs durante el cutover.
- **Fix obligatorio antes de Fase 4 (lanzamiento)**:
  1. Descomentar el return 401 en `app/api/webhooks/mercadopago/route.ts`.
  2. Verificar que `MERCADO_PAGO_WEBHOOK_SECRET` en Secret Manager coincide con el secret en el dashboard de MP (puede haberse regenerado durante el cutover).
  3. Re-correr "Simular notificación" — debe devolver 401 si firma inválida, 200 si válida.
- **Archivos afectados**: `app/api/webhooks/mercadopago/route.ts` línea ~62-66.
- **Fecha resuelto**: PENDIENTE

---

## Nota sobre la reactivación 2026

Al reactivar el proyecto en mayo 2026 (8 meses de pausa) hay que validar que ninguno de los 5 bugs históricos haya regresado. Checklist sugerido para la primera sesión post-reactivación:

1. **Anti-BUG-H001**: cargar la app, hacer una compra de prueba en sandbox MP, verificar que la grilla refleja el cambio dentro de 30s
2. **Anti-BUG-H002**: confirmar que `SELECT COUNT(*) FROM raffle_numbers WHERE status='sold' AND purchaseId IS NULL` da 0
3. **Anti-BUG-H003**: `npm run build` sin errores TypeScript
4. **Anti-BUG-H004**: `vercel env ls` muestra las 5 env vars críticas en Production y Preview
5. **Anti-BUG-H005**: smoke test manual del header

Si alguno regresa, abrir como BUG-006+ con descripción + causa + solución.
