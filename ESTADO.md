# Estado del Proyecto: Sistema de Ventas de Rifas

## Información
- **Proyecto**: Sistema de Ventas de Rifas Escolares
- **Repositorio**: https://github.com/roddb/sistema-ventas-rifas
- **Producción**: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app (Cloud Run, us-east1)
- **Última edición productiva**: Septiembre–Octubre 2025 (rifa escolar 2025)
- **Estado actual**: Reactivación 2026 — proyecto dado de baja al cerrar la rifa anterior, vuelve a levantarse para nueva edición
- **Última sesión**: 2026-05-02 — migración Vercel → Cloud Run completada (proyecto sistema-ventas-rifas-prod, us-east1, 100% Free Tier)
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
- [ ] 1.2 Verificar credenciales MercadoPago vigentes (token PROD puede haber expirado) - TEST
- [ ] 1.3 Verificar conexión a Turso (auth token vigente) - TEST
- [x] 1.4 Verificar deploy en Vercel — variables de entorno presentes y vigentes - TEST
- [ ] 1.5 `npm run dev` local + smoke test del flujo completo en sandbox - TEST
- [ ] 1.6 Re-ejecutar `node run-concurrency-test.js` para validar que la lógica anti-sobreventa sigue intacta - TEST

### Fase 2: Configuración de la nueva rifa 2026
- [ ] 2.1 Decidir parámetros: total de números, precio, fecha del sorteo, premios - DEV
- [ ] 2.2 Reset de la BD: borrar `purchases`, `purchase_numbers`, `event_logs` de la rifa 2025 - DEV
- [ ] 2.3 Crear nuevo registro en tabla `raffles` con configuración 2026 - DEV
- [ ] 2.4 Re-poblar `raffle_numbers` (todos en `available`) según `totalNumbers` - DEV
- [ ] 2.5 Verificar grilla en UI con la nueva configuración - TEST

### Fase 3: Mejoras priorizadas
> Items pendientes detectados en Historial.md sesión 2 + ideas nuevas. Re-priorizar antes de Fase 3.

- [ ] 3.1 Autenticación para panel admin (actualmente oculto pero accesible) - DEV
- [ ] 3.2 Notificaciones por email post-compra exitosa (Nodemailer ya está en deps) - DEV
- [ ] 3.3 Exportación de datos a Excel/CSV desde admin - DEV
- [ ] 3.4 Dashboard de estadísticas en tiempo real (ventas por día, top compradores) - DEV
- [ ] 3.5 Búsqueda de números por comprador (email/DNI) - DEV
- [ ] 3.6 Backup automático programado de la BD - DEV

### Fase 4: Lanzamiento
- [ ] 4.1 Deploy a producción con configuración 2026 - DEV
- [ ] 4.2 Smoke test E2E con compra real de prueba (1 número, monto bajo) - TEST
- [ ] 4.3 Anuncio del lanzamiento al colegio - DEV
- [ ] 4.4 Monitoreo activo primeras 24h post-lanzamiento - TEST

---

## Bitácora

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

## Próxima tarea

**1.5** — `npm run dev` local + smoke test del flujo completo en sandbox MP, validando que la integración Cloud Run + Turso + MP no tiene regresiones, ahora con webhook seguro post-BUG-008. Antes de Fase 4: regenerar MERCADO_PAGO_WEBHOOK_SECRET (fue expuesto en chat).
