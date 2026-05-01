# Registro de Bugs y Correcciones

## Proyecto: Sistema de Ventas de Rifas Escolares
## Iniciado: 2025-09-11
## Última actualización: 2026-05-01

---

## Resumen
- **Total bugs registrados**: 6 (5 históricos + 1 detectado en reactivación)
- **Resueltos**: 6
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

## Nota sobre la reactivación 2026

Al reactivar el proyecto en mayo 2026 (8 meses de pausa) hay que validar que ninguno de los 5 bugs históricos haya regresado. Checklist sugerido para la primera sesión post-reactivación:

1. **Anti-BUG-H001**: cargar la app, hacer una compra de prueba en sandbox MP, verificar que la grilla refleja el cambio dentro de 30s
2. **Anti-BUG-H002**: confirmar que `SELECT COUNT(*) FROM raffle_numbers WHERE status='sold' AND purchaseId IS NULL` da 0
3. **Anti-BUG-H003**: `npm run build` sin errores TypeScript
4. **Anti-BUG-H004**: `vercel env ls` muestra las 5 env vars críticas en Production y Preview
5. **Anti-BUG-H005**: smoke test manual del header

Si alguno regresa, abrir como BUG-006+ con descripción + causa + solución.
