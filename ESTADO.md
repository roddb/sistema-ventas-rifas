# Estado del Proyecto: Sistema de Ventas de Rifas

## Información
- **Proyecto**: Sistema de Ventas de Rifas Escolares
- **Repositorio**: https://github.com/roddb/sistema-ventas-rifas
- **Producción**: https://sistema-ventas-rifas.vercel.app
- **Última edición productiva**: Septiembre–Octubre 2025 (rifa escolar 2025)
- **Estado actual**: Reactivación 2026 — proyecto dado de baja al cerrar la rifa anterior, vuelve a levantarse para nueva edición
- **Última sesión**: 2026-05-01 — gestión modernizada + verificación técnica post-pausa (lint+build verdes, eslintrc creado, PII ignorada)
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
- [ ] 1.1 Revisar `package.json` y actualizar deps con vulnerabilidades críticas (npm audit) - DEV
- [ ] 1.2 Verificar credenciales MercadoPago vigentes (token PROD puede haber expirado) - TEST
- [ ] 1.3 Verificar conexión a Turso (auth token vigente) - TEST
- [ ] 1.4 Verificar deploy en Vercel — variables de entorno presentes y vigentes - TEST
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

**1.1** — Revisar `package.json` y correr `npm audit` para detectar vulnerabilidades críticas tras 8 meses sin updates de dependencias.
