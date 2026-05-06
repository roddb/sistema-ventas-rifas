# Memoria del Proyecto

## Proyecto: Sistema de Ventas de Rifas Escolares
## Repositorio: https://github.com/roddb/sistema-ventas-rifas
## Producción: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app (Cloud Run, us-east1)
## Último save: 2026-05-06 — Save #6 (Fase 6 en producción al 95%, T22 compra real pendiente)

---

## Contexto Actual

**Fases 0-4, 5.B y 6 (al 95%) en producción**. Producción en Cloud Run revision `sistema-ventas-rifas-00014-9wz` con la UI Fase 5.B + combos del evento Fase 6. BD Turso (`sistema-de-riffas`) con 7 tablas: 5 de rifa (1 raffle id=2 a $1.000, 2.000/2.000 raffle_numbers available, 0 sold, 7 cancelled purchases históricas) + 2 de combos (`combo_purchases` y `combo_purchase_items` ambas vacías).

**Cambio crítico cleanup BD 2026-05-05**: Romi test purchase (`PUR-bv13rkdfQQ`) borrada — dijo "fue de prueba, ya devolví el dinero". Precio rifa $2.000 → $1.000 por decisión usuario. BD parte de cero respecto a compras reales (sólo cancelled histórico mantenido como audit).

**Fase 6 — Combos del evento (95% deployed)**:
- **6.0 Brainstorming + spec + plan** ✅ (`docs/superpowers/specs/2026-05-05-combos-evento-design.md` 363 líneas, plan 2.524 líneas con 22 tasks).
- **6.A Server-side** ✅ 12 commits: `lib/combos.ts` catalog hardcoded (3 combos a $15.000) + `ComboService` con idempotencia + 4 API routes `/api/combo/*` + webhook MP dispatch por prefijo `external_reference` (`PUR-` rifa, `COM-` combo, otro `UNKNOWN_REFERENCE`). Tablas `combo_purchases` + `combo_purchase_items` aplicadas a Turso vía MCP (drizzle-kit push se conectaba a BD equivocada por bug shell env). Tests: 10/10 pass.
- **6.B UI** ✅ 6 commits: ProductSplitHero (2 cards Rifa/Combo en home reemplazando HeroLanding) + ComboFlow wizard (catalog → form → review → MP → status) + 5 componentes nuevos. RifasApp con `view: 'home'|'rifa'|'combo'` state. Query param handler `?combo=...&order=COM-xxx` post-redirect.
- **6.C Sandbox MP smoke E2E** SKIPPED por decisión usuario (precedente Fase 5.D — BUG-010 fue detectado por compra real, no sandbox).
- **6.D Deploy** ✅ revision `00014-9wz`. Smoke prod verde: home con split hero, `/api/combo/*` endpoints registrados, CRON_SECRET preservado. **Pendiente compra real $15.000 con tercero (T22)** — no Rodrigo por seller=buyer.

**Fase 5.D parcial**: (a) merge `rediseno-ui/fase-5b` a main + (d) deploy revision `00013-529` cerrados 2026-05-05. Smoke mobile real (b) y compra real (e) absorbidos en T22 de Fase 6.

**Fase 5 al ~95%** (5.A+5.B en producción, 5.C admin pendiente, 5.D parcial cerrado, 5.E logo pendiente):
- **5.0 Brainstorming + spec** ✅ (`docs/superpowers/specs/2026-05-04-rediseno-ui-completo-design.md`, 492 líneas)
- **5.A Fundamentos** ✅ (mergeada a `main`): tailwind config con 17 design tokens (brand `#1E3A8A`, ink, surface, accent ámbar `#F59E0B`, state-*), Inter font con weights 400-900 + CSS variable, 3 layout components (PageContainer max-w-560 con `min-h-dvh`, AppHeader sticky con variants hero/wizard, StickyBottomBar slot wrapper). 9 commits. Plan en `docs/superpowers/plans/2026-05-05-rediseno-ui-fase-5a-fundamentos.md`.
- **5.B Pantallas públicas** ✅ (en feature branch `rediseno-ui/fase-5b`, **sin mergear todavía**): RifasApp 1.587 → 237 líneas slim shell + 13 componentes nuevos en `components/{hero,grid,form,review,status}/`. Bundle `/` 9.22 → 7.15 kB. 13 commits. Plan en `docs/superpowers/plans/2026-05-05-rediseno-ui-fase-5b-pantallas-publicas.md`. La app productiva Cloud Run sigue sirviendo el legacy — el rediseño llega a producción cuando 5.D haga el deploy.
- **5.C Panel admin** pendiente (basic auth + 3 tabs + export CSV).
- **5.D Validación + deploy** pendiente: merge feature branch → main, smoke iPhone Safari + Android Chrome real, concurrency test post-rediseño, deploy Cloud Run vía `./scripts/deploy.sh`, compra real $2.000.
- **5.E Logo + hex institucionales** pendiente (cuando los pase el usuario).

**Fase 7 — Carrito unificado rifa + combos (pendiente brainstorm 2026-05-06)**: pedido del usuario al cierre de Fase 6 — invertir decisión "no cross-product" (que un comprador pueda agregar N números rifa + N combos en un mismo carrito y pagar todo en una sola transacción MP). Esto también reactiva multi-número (la rifa 2025 lo soportaba; Fase 5.B lo restringió a 1). Próxima sesión arranca con `superpowers:brainstorming` para Fase 7 spec → plan → execute. Implicaciones esperadas: schema con purchase padre cross-product, concurrencia (timeout reserva rifa 15min vs combos sin timeout), webhook dispatch atómico, UI (split hero pierde sentido), MP preference items mezclados, naming nuevo (probablemente `ORD-xxx`).

**Decisiones de diseño locked en sesión 5**:
- Naming tokens: `brand`/`ink`/`surface-raised` (mejora semántica) en lugar del literal del spec `primary`/`text-primary`/`surface-elevated`. Spec quedó como referencia conceptual.
- Estilo "Moderno confiado" (Inter sans, bloques sólidos, jerarquía firme).
- Paleta C: azul royal + blanco + ámbar.
- Grid model B: paginado por centenas (20 tabs scrolleables) con search bar arriba.
- Multi-número: 1 por compra (UI restringe). **REVISAR EN FASE 7** — el pedido del usuario invierte esto.
- 3 campos del estudiante mantenidos (nombre + año + división).
- Skeleton-then-meat: shell con placeholders primero, pantallas después.
- `min-h-dvh` over `min-h-screen` (fix iPhone Safari URL bar jiggle).

**Decisiones de diseño locked en sesión 6 (combos)**:
- **Split entry hero** (2 cards Rifa/Combo en home): elegida sobre tabs horizontales o pill toggle. **REVISAR EN FASE 7** — el carrito unificado le quita sentido.
- **Stock ilimitado** para combos (sin reservation timeout, sin race conditions sobre combos).
- **Carrito multi-combo** (1 transacción MP por carrito de combos).
- **Datos del comprador solo** (nombre + email + teléfono, sin bloque estudiante). Combos no son fundraising por curso.
- **Catálogo hardcoded** en `lib/combos.ts` (3 combos a $15.000 fijos, sin admin UI para editar).
- **Filas compactas con stepper** (vs cards grandes — los 3 entran sin scroll en mobile).
- **Tablas separadas** `combo_purchases` + `combo_purchase_items` (vs polimórfico sobre `purchases`). Limpieza de schema, dispatch por prefijo.
- **Webhook único reusado** con dispatch post-HMAC por prefijo `external_reference` (`PUR-` rifa, `COM-` combo, otro = log + 200).
- **Event types con prefijo `COMBO_`** (`COMBO_PURCHASE_CREATED`, `COMBO_PAYMENT_CONFIRMED`, etc.) para auditoría limpia. `event_logs.purchase_id` reusada como genérica (text, sin FK enforcement en SQLite/libsql).
- **NO compra cross-product** entre rifa y combos (Fase 6 sección 2). **REVERTIDO EN FASE 7** por pedido usuario.

**Issue M-9 pendiente** detectado por final reviewer 5.B: si user hace back desde review a form y resubmit, se crea purchase zombie + 2do número reservado. Same behavior que el legacy. Decision: 5.D evalúa si vale invocar `/api/purchase/cancel` explícitamente en goBack de review.

**BUG-010 cerrado** (2026-05-04): bloque `env: { NEXT_PUBLIC_BASE_URL: ... || 'http://localhost:3000' }` en `next.config.js` forzaba a Next.js a inlinear el valor en build time → preferences MP creadas con `back_urls=""` y `notification_url=localhost` → MP rechazaba con CPT01. Fix: bloque `env` removido. Validado en producción con compra real $2.000 de Romi.

**Lecciones operativas pendientes de aplicar a futuro**:
- Smoke tests automatizados de pago deben **inspeccionar las URLs internas del preference creado vía MP API** (`GET /checkout/preferences/{id}` con bearer token), no sólo confirmar que `/api/preference` devolvió 200. El bug se descubrió en compra real de un tercero.
- El bloque `env` en `next.config.js` debe evitarse para variables que pueden ser `undefined` en build time.
- En worktrees nested dentro del repo padre, `next lint` detecta dos `.eslintrc.json` (parent + worktree) y se queja. Fix: agregar `"root": true` al eslintrc del worktree.

**Histórico de la rifa 2025** (referencia): cerrada en octubre 2025. 1.500 números, $2.000 c/u, 1.081 sold, 134 compras approved. Backup completo en `backups/rifa-2025-backup-2026-05-04.json` (gitignored, 830 KB) antes del reset.

**Pre-Fase 4 gates resueltos**: (a) regenerar `MERCADO_PAGO_WEBHOOK_SECRET` SKIPPED por decisión del usuario; riesgo residual mitigado por reconfirmación contra MP API + filtro `external_reference`. (b) Cloud Scheduler `rifa-cleanup` (us-east1, `*/5 * * * *`) COMPLETADO con secret `cron-secret` en Secret Manager.

**Fase 3 (mejoras)**: 3.1 (auth admin) absorbida en spec Fase 5. 3.2 (email post-compra) descartada. 3.3 (export CSV) parcialmente absorbida en spec Fase 5. 3.4-3.6 quedan postergadas post-lanzamiento.

**BUG-010 cerrado** (2026-05-04): bloque `env: { NEXT_PUBLIC_BASE_URL: ... || 'http://localhost:3000' }` en `next.config.js` forzaba a Next.js a inlinear el valor en build time en todo el bundle (incluso server code). Como el Docker build no recibe `NEXT_PUBLIC_BASE_URL`, el fallback `localhost:3000` quedaba hardcoded en el JS compilado. La env var de Cloud Run nunca se leía → preferences MP creadas con `back_urls` vacías y `notification_url` apuntando a localhost → MP rechazaba con `CPT01`. Fix: remover el bloque `env` de `next.config.js`. Validado en producción con compra real $2.000 de Romi.

**Lecciones operativas pendientes de aplicar a futuro**:
- Smoke tests automatizados de pago deben **inspeccionar las URLs internas del preference creado vía MP API** (`GET /checkout/preferences/{id}` con bearer token), no sólo confirmar que el endpoint devolvió 200. El bug se descubrió en compra real de un tercero.
- El bloque `env` en `next.config.js` debe evitarse para variables que pueden ser `undefined` en build time. Para variables server-only, no usar prefijo `NEXT_PUBLIC_` (prefijo es para variables que SÍ se exponen al cliente).

**Histórico de la rifa 2025** (referencia): cerrada en octubre 2025. 1.500 números, $2.000 c/u, 1.081 sold, 134 compras approved. Backup completo en `backups/rifa-2025-backup-2026-05-04.json` (gitignored, 830 KB) antes del reset.

**Pre-Fase 4 gates resueltos**: (a) regenerar `MERCADO_PAGO_WEBHOOK_SECRET` SKIPPED por decisión del usuario; riesgo residual mitigado por reconfirmación contra MP API + filtro `external_reference`. (b) Cloud Scheduler `rifa-cleanup` (us-east1, `*/5 * * * *`) COMPLETADO con secret `cron-secret` en Secret Manager.

**Fase 3 (mejoras)**: 3.1 (auth admin) absorbida en spec Fase 5. 3.2 (email post-compra) descartada. 3.3 (export CSV) parcialmente absorbida en spec Fase 5. 3.4-3.6 quedan postergadas post-lanzamiento.

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

### Sesión 6 — 2026-05-05/06 (Fase 5.D parcial + Fase 6 al 95% en producción)
- **Duración aproximada**: ~6h efectivas
- **Resumen**: Sesión muy larga que cerró 3 hitos: (1) Fase 5.D paso (a)+(d) — merge `rediseno-ui/fase-5b` a main + deploy revision `00013-529` poniendo el rediseño UI en producción; (2) cleanup BD (Romi test purchase borrada + precio rifa $2.000 → $1.000 por decisión usuario); (3) Fase 6 completa al 95% — brainstorm + spec + plan + 22 tasks ejecutados con subagent-driven-development (haiku/sonnet) + deploy revision `00014-9wz` con combos en producción. Sólo falta T22 compra real con tercero.
- **Logros**:
  - **Fase 5.D paso (a)+(d)** (3 commits en main): merge `--no-ff` del feature branch (20 commits internos), cleanup worktree, fix `scripts/deploy.sh` agregando `CRON_SECRET=cron-secret:latest` al `--set-secrets` (estaba perdiéndose desde revision `00010-jlz`, `/api/cron/cleanup` quedó fail-open por 3 revisiones), deploy a Cloud Run.
  - **Cleanup BD productiva**: vía Turso MCP en orden FK-safe — DELETE purchase_numbers + event_logs `purchase_id='PUR-bv13rkdfQQ'` + UPDATE raffle_numbers id=2001 a available + DELETE purchase + UPDATE raffles set price_per_number=1000.
  - **Fase 6.0 brainstorm** con visual companion (3 mockups: tab pattern, combo picker, layout). 5 secciones de diseño aprobadas. Spec 363 líneas, plan 2.524 líneas (22 tasks).
  - **Fase 6.A server-side** (12 commits): `lib/combos.ts` con TDD, schema Drizzle + migration, `ComboService` idempotente (optimistic locks `WHERE payment_status='pending'`), `createComboPreference` helper, 4 API routes, webhook dispatch por prefijo `external_reference`. `payment-flow-debugger` agent confirmó zero regresión rifa.
  - **Fase 6.B UI** (6 commits): `ProductSplitHero` (2 cards Rifa/Combo), `ComboFlow` orchestrator, 5 componentes nuevos. RifasApp con view state `'home'|'rifa'|'combo'`. Query param handler post-redirect MP.
  - **Fase 6.D deploy**: revision `00014-9wz` con smoke prod verde — home con split hero, `/api/combo/*` registrados, CRON_SECRET preservado, env secrets OK.
  - **Subagent-driven workflow**: 22 implementer subagents (haiku para mecánicas, sonnet para integración como T11 webhook + T18 orchestrator) + 4 reviewers (db-migration, spec compliance, code quality, payment-flow-debugger). Único retry: T5 fix de `purchaseId` en eventLogs.
- **Problemas encontrados**:
  - **Drizzle-kit push se conectó a BD equivocada (planificador-docente)** durante T4: el shell del dev tenía `TURSO_DATABASE_URL` exportada apuntando a otra BD, dotenv 17 no override por default. Detectado a tiempo (las tablas listadas no eran de la rifa). **Mitigación**: aplicación manual de los 2 CREATE TABLE vía Turso MCP especificando `database='sistema-de-riffas'` explícitamente. Cero impacto en BD equivocada.
  - **Spec deviation T5**: implementer omitió `purchaseId` en eventLogs por asumir FK enforcement. Reviewer detectó. Fix en `7902ac4`.
  - **Permission prompts excesivos**: `Bash(cd:*)` no bypasea heurísticas de seguridad para backslash-escaped whitespace ni para `cd ... 2>/dev/null` redirections. Fix: instruir subagentes a usar comillas dobles + evitar redirections en compound commands.
  - **drizzle-kit `push:sqlite` deprecated**: nuevo comando es `push` sin sufijo de dialect.
  - **tsconfig target es5 → es2020**: drizzle-kit no podía compilar el schema con target ES5. Bonus fix incluido.
  - **Pedido del usuario al cierre**: carrito unificado rifa + combos en una sola compra MP. Invierte decisión Fase 6 sección 2 ("no cross-product"). Fase 7 brainstorm en próxima sesión.
- **Estado al cerrar**: Combos en producción al 95%. T22 compra real con tercero (Romi probablemente) pendiente. BD lista (combo tables vacías). Próxima sesión: brainstorm Fase 7 carrito unificado (cross-product). Smoke mobile real Fase 5.D paso (b) sigue pendiente — el usuario puede testearlo en su propio celular antes de la próxima sesión si quiere.

### Sesión 5 — 2026-05-05 (Fase 5.A en main + Fase 5.B en feature branch)
- **Duración aproximada**: ~5h
- **Resumen**: Sesión larga de implementación lineal del rediseño UI. Ejecuté Fase 5.A (fundamentos) directo en main, después armé worktree y feature branch para Fase 5.B (las 5 pantallas públicas + payment routes), todo via subagent-driven development con haiku model. Se reemplazó el monolito `RifasApp.tsx` (1.587 líneas) por 13 componentes pequeños + un shell de 237 líneas. Final reviewer aprobó ambas fases; 1 issue importante de 5.B (URL params persistentes post-redirect) fixeado en mismo branch.
- **Logros**:
  - **Fase 5.A** (9 commits en main): tailwind con 17 design tokens, Inter weights 400-900, globals.css limpio, 3 layout components (PageContainer, AppHeader, StickyBottomBar). Build verde, lint clean. Final review aprobó con nits diferidos a 5.B (que se aplicaron en task 10 de 5.B).
  - **Worktree setup** en `.worktrees/fase-5b` con branch `rediseno-ui/fase-5b` aislado del main. `.gitignore` actualizado con `.worktrees/`. eslintrc del worktree con `root: true` para evitar conflicto con eslint del repo padre (caso clásico de worktree nested).
  - **Fase 5.B** (13 commits en feature branch): RifasApp slim shell + HeroLanding + (NumberCell+GridLegend+NumberSearch+RangeTabs+NumberGrid) + (FormField+StudentBlock+BuyerForm) + PurchaseReview + (SuccessScreen+FailureScreen+PendingScreen) + 3 payment route fallbacks fixeados + cleanup nits 5.A + scrollbar-hide utility + fix I-1 query params cleanup. Bundle `/` 9.22 → 7.15 kB.
  - **Plans escritos** y commiteados a main: `docs/superpowers/plans/2026-05-05-rediseno-ui-fase-5{a,b}.md`.
  - **Producción intacta**: Cloud Run sigue sirviendo revision `00012-xrl` con el legacy. El rediseño llega a producción en 5.D después del smoke en mobile real.
- **Problemas encontrados**:
  - **BUG-010 era previa sesión**, no se trabajó en esta. La sesión arrancó con BD limpia y producción estable.
  - **Issue I-1 5.B** (final reviewer): URL params `?payment=...` se consumían pero quedaban persistentes en el URL. Fix con `window.history.replaceState({}, '', '/')` después de detectar el payment param.
  - **Issue M-9 5.B** (final reviewer, diferido): goBack desde review crea zombie purchase + reserva 2do número. Same behavior que el legacy. Worth evaluar en 5.D si invocar `/api/purchase/cancel` en goBack del review.
  - **eslint conflict en worktree nested**: `next lint` detecta 2 `.eslintrc.json` (padre + worktree) y se queja. Fix `root: true` en eslintrc del worktree.
  - **scrollbar-hide no es utility default de Tailwind 3** — necesita declararse en globals.css. RangeTabs lo usaba sin haberse declarado primero; el build no fallaba (Tailwind silently drops unknown classes), pero la barra horizontal mostraba scrollbar. Fix en globals.
  - **Naming tokens divergió del spec literal**: spec listaba `primary`/`text-primary`/`surface-elevated`, implementación usó `brand`/`ink`/`surface-raised`. Mejora semántica real (evitar colisión con keyword `border` y con palette legacy `primary.X`). Documentado en MEMORIA.
- **Estado al cerrar**: rediseño UI al ~65% (5.0+5.A+5.B done; 5.C+5.D+5.E pendientes). Branch `rediseno-ui/fase-5b` pusheada a GitHub esperando merge en 5.D. Producción intacta. Próxima tarea: 5.D — merge + smoke mobile + concurrency + deploy + compra real.

### Sesión 4 — 2026-05-04/05 (fix BUG-010 + cierre Fase 4.2 + spec Fase 5)
- **Duración aproximada**: ~3h
- **Resumen**: Sesión que arrancó como debug emergente de un error de pago en producción reportado por compradora real (Romi) y derivó en (a) descubrimiento + fix de BUG-010 (Next.js env inline hardcodeando localhost), (b) compra real exitosa que cerró Fase 4.2 al 100%, (c) brainstorm completo del rediseño UI con spec aprobado.
- **Logros**:
  - **BUG-010 detectado, diagnosticado y resuelto** en ~30 min: 2 errores `CPT01` consecutivos de Romi → diagnóstico vía `gcloud secrets versions access` + `curl` a MP API → identificación del bloque `env` en `next.config.js` que forzaba inline en build → fix removiendo el bloque → deploy `00012-xrl`.
  - **Cleanup BD asociado** con guards anti-sobreventa: 7 purchases pending pasaron a cancelled, 2 raffle_numbers liberados a available, 3 entradas en purchase_numbers borradas. Todas las escrituras dentro de la convención `WHERE status='reserved' AND purchase_id=...` y `payment_status='pending'` con `rowsAffected` validado.
  - **Bonus fix**: título item MP cambiado `"Rifa Escolar 2025"` → `"Rifa Escolar 2026"` en `lib/mercadopago.ts:44` (deploy `00011-jdr`).
  - **Compra real exitosa de Romi** (PUR-bv13rkdfQQ, $2.000) cerró la cadena end-to-end del fix. Fase 4.2 marcada `[x]` definitivamente.
  - **Brainstorm rediseño UI** (Fase 5) con `superpowers:brainstorming` skill + visual companion local: 6 rondas de Q&A con mockups HTML side-by-side. Decisiones cerradas: estilo C "Moderno confiado", paleta C azul royal/blanco/ámbar, grid B paginado, 1 número por compra, admin in-scope con basic auth, mantener 3 campos del estudiante.
  - **Spec escrito y aprobado**: `docs/superpowers/specs/2026-05-04-rediseno-ui-completo-design.md` (492 líneas) cubre 7 pantallas + admin + tokens + estructura de componentes + estrategia de migración + cronograma 6-9 sesiones.
  - **ESTADO.md** actualizado con Fase 5 (5.0 a 5.E).
- **Problemas encontrados**:
  - **BUG-010**: tipo "smoke test gap" — los 5 tests automatizados de Fase 4.2 sólo validaban que `/api/preference` devolviera `200 + initPoint`. NO inspeccionaban las URLs internas del preference creado. Detectado por usuario externo, no por el sistema de QA.
  - **Visual companion** se cayó dos veces durante la sesión (timeout 30 min de inactividad y por shell sandboxing). Reiniciado con `--foreground` + `run_in_background:true` la segunda vez.
  - **MP MCP server**: el usuario intentó conectarlo para usar `simulate_webhook` antes de cerrar 4.2 sin compra real. Falló con "Failed to reconnect". Decisión: pasar a compra real, que terminó siendo más eficiente (cerró el bug + cerró 4.2 simultáneamente).
- **Estado al cerrar**: producción estable, 1 compra real `approved`, BD limpia. Fase 5 lista para arrancar el plan de implementación con `superpowers:writing-plans`. Pendiente: logo STA + hex institucionales reales del usuario.

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
