# Memoria del Proyecto

## Proyecto: Sistema de Ventas de Rifas Escolares
## Repositorio: https://github.com/roddb/sistema-ventas-rifas
## Producción: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app (Cloud Run, us-east1)
## Último save: 2026-05-04 — Save #3 (cierre Fase 2 + fix BUG-009)

---

## Contexto Actual

Fases 0, 1 y 2 cerradas al 100%. Reactivación 2026 lista del lado de BD y UI: la BD productiva Turso `sistema-de-riffas` tiene una sola rifa activa (id=2, "Rifa Escolar 2026", 2.000 números a $2.000, sin fecha de sorteo definida, `endDate` placeholder 2026-12-31). El frontend en Cloud Run (revision `00008-bg2`) renderiza correctamente la grilla con los 2.000 números disponibles tras fix de BUG-009 (loop infinito en `useEffect` que estuvo latente 8 meses oculto detrás del flag `VENTAS_CERRADAS=true`).

El estado funcional al cierre de octubre 2025 fue producción estable con la rifa "Rifa Escolar 2025" (corrigiendo dato previo de MEMORIA: la 2025 tuvo **1.500 números, no 2.000** — el default del schema). 134 compras `approved`, 1.081 números `sold`, 9 reservas que nunca se cerraron en `pending`. Todo ese estado quedó respaldado en `backups/rifa-2025-backup-2026-05-04.json` (gitignored, 830 KB) antes del reset.

Pendientes pre-Fase 4 (gates obligatorios antes del lanzamiento): (a) regenerar `MERCADO_PAGO_WEBHOOK_SECRET` que se expuso en chat 2026-05-02 durante diagnóstico BUG-008, (b) configurar Cloud Scheduler para `/api/cron/cleanup` cada 5 min (en Vercel había auto-cron, en Cloud Run hay que setearlo). Después: Fase 4 (deploy ya en prod / smoke E2E con compra real / anuncio / monitoreo). La Fase 3 (mejoras: auth admin, email post-compra, exportes, backup BD) queda postergada post-lanzamiento.

## Decisiones de Diseño

### Arquitectura general
- **Server-side authority**: la BD Turso es la única fuente de verdad. UI consulta vía API routes, no tiene estado persistente local
- **Optimistic UI desactivado**: ante cualquier acción crítica (reservar, comprar) la UI espera respuesta del server antes de actualizar la grilla
- **Polling cada 30s**: la grilla se refresca automáticamente para reflejar reservas/ventas de otros usuarios
- **Botón refresh manual**: redundancia para casos de falla de polling

### Modelo de datos (Drizzle schema en `lib/db/schema.ts`)
- `raffles`: configuración (id, title, pricePerNumber, totalNumbers, status, createdAt). Una sola rifa activa por vez
- `raffle_numbers`: 1 fila por número (id es el número en sí, status='available'|'reserved'|'sold', purchaseId nullable). Pre-pobladas al crear la rifa
- `purchases`: cabecera de compra (id, buyerName, buyerEmail, buyerPhone, totalAmount, status='pending'|'approved'|'rejected'|'cancelled', mpPreferenceId, mpPaymentId, createdAt, updatedAt)
- `purchase_numbers`: many-to-many entre `purchases` y `raffle_numbers`
- `event_logs`: audit trail (id, eventType, payload JSON, createdAt) — todas las transiciones de estado

### Reservas con timeout
- Al crear `purchase`, los números pasan a `reserved` con un timestamp
- Cron `/api/cron/cleanup` corre cada N minutos liberando reservas con `createdAt < NOW - 15min`
- Si el usuario cierra el browser antes de pagar, los números se liberan automáticamente
- Si el pago falla en MP, el callback `/api/payment/failure` libera inmediatamente

### Anti-sobreventa
- `raffleService.reserveNumbers()` usa `db.transaction(...)` y `UPDATE raffle_numbers SET status='reserved' WHERE id IN (...) AND status='available'`
- Verifica `result.rowsAffected === requestedCount` — si no, hace rollback y devuelve error claro al usuario
- Tests en `test-concurrency.js` cubren conflicto directo (2 usuarios mismo número) y conflictos múltiples (4 usuarios, números superpuestos)

### Integración MercadoPago
- Modo Checkout Pro (no Bricks ni Direct API) — minimiza superficie de implementación
- Preference creada server-side en `/api/preference` con `notification_url` apuntando al webhook
- Callback URLs (`success`, `failure`, `pending`) son **solo para UX** — la verdad la dicta el webhook
- Webhook verifica firma HMAC con `MERCADO_PAGO_WEBHOOK_SECRET`
- Idempotencia: el webhook puede recibir la misma notificación múltiples veces; siempre verificar `purchase.status` antes de updatear

### Caché y refresh
- Todas las API routes con `export const dynamic = 'force-dynamic'` y `revalidate = 0`
- Headers `Cache-Control: no-store, no-cache, must-revalidate` en respuestas con datos
- Frontend usa `useState` (no `useLocalStorage`) — evita datos obsoletos entre sesiones

## Stack Técnico

- Framework: Next.js 14.2.5 (App Router)
- Lenguaje: TypeScript 5.5.4 strict mode
- Runtime: React 18.3.1
- BD: Turso (SQLite edge) via `@libsql/client` 0.8.1
- ORM: Drizzle ORM 0.32.2 + drizzle-kit 0.23.2 (dialect: sqlite, driver: turso)
- Pagos: SDK `mercadopago` 2.0.15 (Checkout Pro + webhook IPN)
- Validación: Zod 3.23.8 (en API routes)
- Email: Nodemailer 6.9.14 (presente en deps, sin uso real todavía — pendiente Fase 3.2)
- Estilos: Tailwind CSS 3.4.7
- Iconos: lucide-react 0.427.0
- IDs: nanoid 5.1.5
- Hosting: Vercel (preview = TEST credentials, prod = APP_USR credentials)
- Package manager: npm

## Convenciones

- Workflow obligatorio: DIAGNOSE → PLAN → EXECUTE → VALIDATE → DOCUMENT → COMMIT (ver CLAUDE.md)
- Code style: ver sección "Code Style & Conventions" en CLAUDE.md
- Estados de número: `available` | `reserved` | `sold` (no agregar otros)
- Estados de compra: `pending` | `approved` | `rejected` | `cancelled`
- Naming de API routes: REST-ish (`/api/recurso/accion`), siempre devolver `{ success: bool, data?: any, error?: string }`
- Mensajes de commit estilo conventional: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Toda manipulación manual de la BD debe pasar por `lib/services/raffleService.ts` o, si es excepcional, hacerse en una transacción que toque las 3 tablas (`raffle_numbers`, `purchases`, `purchase_numbers`)

## Notas Importantes

- **BD productiva ya limpia y reconfigurada (2026-05-04)**: 1 sola rifa activa (id=2, "Rifa Escolar 2026", 2.000 números a $2.000). Backup completo de la rifa 2025 en `backups/rifa-2025-backup-2026-05-04.json`.
- **Credenciales MP**: el access token de producción puede haber rotado o expirado tras 8 meses. Verificar en Fase 1.2 antes de cualquier deploy.
- **Auth token Turso**: idem MP — verificar vigencia.
- **No hay tests automatizados unitarios**: los tests están limitados a concurrencia (3 scripts en raíz). Si se agrega lógica nueva en `raffleService` considerar tests adicionales.
- **Panel admin sin autenticación**: actualmente está oculto en UI pero la URL es accesible. Pendiente Fase 3.1 antes del próximo lanzamiento.
- **Email post-compra**: Nodemailer está instalado pero no integrado. Pendiente Fase 3.2.
- **Modo demo / simulación**: ya fue removido en sesión 2025-09-11; cualquier botón de "simular pago" que aparezca es regresión.
- **Hosting**: Cloud Run en us-east1 (proyecto sistema-ventas-rifas-prod, account intellego.ok@gmail.com). 100% Free Tier.
- Proyecto gestionado con `/inicio` y `/save`. Aprendizajes con `/autoaprendizaje`.

## Histórico de la rifa 2025 (referencia)

Rifa cerrada en octubre 2025. Datos reales (extraídos de la BD el 2026-05-04 antes del reset):
- **1.500 números** (no 2.000 como decía esta MEMORIA antes — era el default del schema), $2.000 cada uno
- 1.081 números `sold`, 419 `available` (no se vendió todo), 0 `reserved`
- 143 compras: 134 `approved`, 9 `pending` que nunca se cerraron, 0 `rejected/cancelled`
- 950 entradas en `purchase_numbers` (inconsistencia de 131 sold sin entrada — residuo de BUG-H002)
- 417 entradas en `event_logs`
- Backup completo en `backups/rifa-2025-backup-2026-05-04.json` (830 KB, gitignored)
- Compradores de prueba documentados en `old_docs/Historial.md`: Rodrigo Di Bernardo (números 1, 2 — $4.000), Rosario Aguerre (números 4, 5 — $4.000)
- Sistema funcionó sin sobreventa reportada
- Documentación de la integración MP en `old_docs/INTEGRACION_MERCADOPAGO.md` y `old_docs/TUTORIAL_MERCADOPAGO.md`
- Test de concurrencia documentado en `old_docs/TEST_CONCURRENCIA.md`

---

## Historial de Sesiones

### Sesión 3 — 2026-05-04 (cierre Fase 2 + fix BUG-009)
- **Duración aproximada**: ~2h
- **Resumen**: Configuración de la rifa 2026 en BD productiva (Fase 2 completa) + descubrimiento y fix de BUG-009 (loop infinito en `useEffect` latente desde 2025).
- **Logros**:
  - Parámetros decididos (2.1): 2.000 números a $2.000, sin fecha de sorteo definida (manual cuando sea), sin premios documentados.
  - Script nuevo `scripts/setup-rifa-2026.mjs` con 2 modos (`--backup-only` por default, `--commit --yes` destructivo). Validado por `db-migration-reviewer` antes de ejecutar.
  - Backup completo de la BD 2025 a `backups/rifa-2025-backup-2026-05-04.json` (gitignored, 830 KB con PII completa de los 134 compradores).
  - Reset destructivo en transacción atómica: DELETE en orden por FKs (`purchase_numbers` → `event_logs` → `purchases` → `raffle_numbers` → `raffles`), INSERT 1 nueva rifa (`raffleId=2`), batch INSERT 2.000 `raffle_numbers` en chunks de 500.
  - 2 deploys a Cloud Run: revision `00007-bbh` (cambio título dinámico + `VENTAS_CERRADAS=false`), revision `00008-bg2` (fix BUG-009 split useEffect).
  - Verificación final: `/api/raffle/config` devuelve "Rifa Escolar 2026" / 2.000 / $2.000 / id=2; `/api/numbers` devuelve 2.000 disponibles; UI renderiza grilla completa.
- **Problemas encontrados**:
  - **Bug pre-flight `dotenv@17`**: por default no sobrescribe vars del shell. El shell del dev tenía `TURSO_DATABASE_URL` exportada apuntando a `planificador-docente`; el script habría reseteado la BD equivocada. Fix con `loadEnv({ override: true })` antes de cualquier query.
  - **Bug pre-flight orden DELETE**: `db-migration-reviewer` detectó que el orden propuesto borraba `purchases` antes que `event_logs`, violando FK `event_logs.purchase_id → purchases.id`. Reordenado pre-ejecución.
  - **BUG-009** (productivo, descubierto en 2.5): loop infinito de re-render en `RifasApp.tsx` que mantenía `loading=true`. Latente por 8 meses oculto detrás de `VENTAS_CERRADAS=true`.
  - **Hardcodeos en componente**: título "Rifa Escolar 2025" en `RifasApp.tsx:1440`. Cambiado a leer `raffleConfig.title`. La constante `VENTAS_CERRADAS` también es hardcoded — promovida a deuda técnica para derivar de `raffleConfig.isActive` en una próxima iteración.
- **Estado al cerrar**: Rifa 2026 servida en producción con grilla funcional. Próxima sesión arranca con los 2 gates pre-Fase 4 (regenerar webhook secret + Cloud Scheduler) y luego smoke E2E con compra real (4.2).

### Sesión 2 — 2026-05-02 (migración Vercel → Cloud Run)
- **Duración aproximada**: ~3h
- **Resumen**: Diagnóstico del pause de Vercel + decisión de migración + ejecución completa.
- **Logros**:
  - Diagnóstico Vercel: workspace pausado (hipótesis: detección automática de uso comercial), proyecto `sistema-ventas-rifas` eliminado, sin invoice impaga, caps de uso todos OK
  - Brainstorming con 7 decisiones documentadas en `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`
  - Plan de implementación en `docs/superpowers/plans/2026-05-02-migracion-cloud-run.md`
  - Containerización: Dockerfile multi-stage Node 20 slim (Debian) + `.dockerignore` + `output: 'standalone'` en next.config.js. Cambio Alpine → Debian forzado por incompat de @libsql/client con musl.
  - Setup GCP: proyecto `sistema-ventas-rifas-prod` (project number 63979708570), billing asociado, 4 APIs habilitadas (run/cloudbuild/artifactregistry/secretmanager), repos Artifact Registry `app` (vacío) y `cloud-run-source-deploy` (en uso) con cleanup policies
  - Secret Manager: 4 secrets (turso-auth-token, mp-access-token, mp-client-secret, mp-webhook-secret) con permiso secretAccessor al SA de Cloud Run
  - Deploy en us-east1: revision `sistema-ventas-rifas-00002-8zs`, min 0 / max 10, 512Mi / 1 vCPU, allow-unauthenticated
  - URL productiva: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app
  - Smoke tests pasados: HTTP 200 (250ms), /api/raffle/config conecta a Turso (1500 números a $1000), /api/numbers/verify responde, logs limpios, cold start 4.2s
  - Webhook MP migrado: simulación devolvió 200
  - Fix BUG-008 completo: bug "webhook acepta firmas inválidas" expandido a 7 sub-bugs encadenados (008 base + 008-A a 008-G). Plan ejecutado en 6 commits + validación E2E. El sub-bug 008-G (ts en ms, no segundos) salió solo en validación con simulación dashboard MP — debug logs temporales revelaron `ts header: 1777861637614` (13 dígitos = ms). Fix completo: módulo `lib/webhook-verification.ts` con manifest oficial + parseo robusto + normalización ms→sec, handler con bypasses cerrados, idempotencia y locks optimistas en confirmPayment/cancelPayment/releaseExpiredReservations.
- **Problemas encontrados**:
  - BUG-007: Vercel auto-pause (resuelto vía migración)
  - BUG-008: handler webhook acepta firmas inválidas (preexistente; pendiente fix antes de Fase 4)
  - Issue operativo: @libsql/client requiere glibc, no musl — Dockerfile cambió a Debian slim
- **Estado al cerrar**: Servicio Cloud Run productivo. Costo acumulado GCP: $0. Próxima tarea: 1.5 (smoke test del flujo completo en sandbox MP) o priorizar fix de BUG-008.

### Sesión 1 — 2026-05-01 (verificación técnica post-pausa)
- **Duración aproximada**: ~30 min
- **Resumen**: Cierre de Fase 0 (tareas 0.9 y 0.10). Verificación de que el repo sigue siendo buildable después de 8 meses sin tocar código. Detección y mitigación de issues de scaffolding/seguridad emergentes durante la verificación.
- **Logros**:
  - `.eslintrc.json` creado (faltaba — `next lint` se quedaba esperando input interactivo y el stop-quality-gate fallaba)
  - 4 errores `react/no-unescaped-entities` corregidos en `RifasApp.tsx` (preexistentes desde 2025, nunca detectados por lint hasta hoy)
  - `npm run build` verde: 7 rutas API + página principal compilan
  - BUG-006 detectado y resuelto: `ventas_rifas_completo_2025.csv` con PII real estaba untracked y a punto de commitearse en el primer `git add -A`. Mitigado con patrón `*.csv` en `.gitignore`.
- **Problemas encontrados**: BUG-006 (PII en working tree)
- **Estado al cerrar**: Fase 0 al 100%. Próxima sesión: Fase 1.1 — `npm audit` y revisión de deps con vulnerabilidades.

### Sesión 0 — 2026-05-01 (reactivación + modernización)
- **Duración aproximada**: ~1h
- **Resumen**: Reactivación del proyecto tras 8 meses de pausa; modernización completa de la infraestructura de gestión replicando el patrón de Intellego Platform, Diseño_cuadernillos y Auditoría PAIDEIA.
- **Logros**:
  - Backup de docs previos en `old_docs/`
  - 5 .md de gestión nuevos (CLAUDE, ESTADO, MEMORIA, BUGS, LEARNINGS) + README reescrito
  - `.claude/settings.json` con 5 hooks versionados
  - 6 commands (/inicio, /save, /autoaprendizaje, /allow, /test-concurrencia, /deploy-vercel)
  - 4 agents (diagnosis-specialist, payment-flow-debugger, concurrency-validator, db-migration-reviewer)
- **Problemas encontrados**: ninguno (tarea de scaffolding)
- **Estado al cerrar**: estructura de gestión lista. Próxima sesión: arrancar Fase 1 (verificación técnica post-pausa).

### Sesiones históricas (2025)
Documentadas exhaustivamente en `old_docs/Historial.md`. Resumen:
- Sesión 1 (2025-09-11): debugging desincronización BD-frontend, integración MP completa
- Sesión 2 (2025-09-14): test de concurrencia
- Sesiones 3+ (2025-09-26, 2025-10-10): pulido y operación productiva
