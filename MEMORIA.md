# Memoria del Proyecto

## Proyecto: Sistema de Ventas de Rifas Escolares
## Repositorio: https://github.com/roddb/sistema-ventas-rifas
## Producción: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app (Cloud Run, us-east1)
## Último save: 2026-06-12 — Save #14 (Fase 12.1 + 12.2 + 12.3: combo empanadas con gustos, cierre 6/7, tickets alumno-primero)

---

## Contexto Actual

**Save #13 el 2026-06-09. El sistema fue RESETEADO y reabierto para la SEGUNDA SEDE del colegio** (mismo evento, distintos directores). El evento de la sede 1 ya terminó (29/05). Se reusó el mismo sitio/URL/Cloud Run + misma cuenta MercadoPago, reseteando la BD. Nueva rifa **id=3 "Rifa Escolar 2026 - Sede 2"**, 2000 números disponibles, **$1.000 c/u**, revision **`00021-fdd`**, **ventas abiertas**. Antes del reset se respaldaron las **8 tablas** de sede 1 (145 orders approved, $4.798.000, 4.568 filas) en `backups/rifa-sede1-final-backup-2026-06-09.json` (gitignored, PII). El script viejo `setup-rifa-2026.mjs` sólo cubría 5 tablas (pre-Fase 7), así que se escribió `scripts/reset-rifa-sede2.mjs` nuevo (8 tablas, orden DELETE FK-safe, atómico) revisado por `db-migration-reviewer` (APROBADO con observaciones). Se removió el gate de fecha hardcoded `SALES_CLOSE_TS` de sede 1 en `RifasApp.tsx` (sin eso, resetear la BD no alcanzaba: el cartel "cerrado" se mostraba igual). El cierre actual depende sólo del soft gate `is_active` hasta implementar la tarea 12.1. El Bingo Escolar no necesitó cambios (client-side puro, la sede 2 lo reusa tal cual).

**Fase 12 EN PROGRESO** (`docs/superpowers/plans/2026-06-09-fase-12-cambios-sede2.md`). **12.1 + 12.2 implementadas, validadas y DEPLOYADAS a producción el 2026-06-12** (Cloud Run revision `00022-hzf`, mergeado a main commit `d53aa2c`, smoke prod E2E verde con inspección de URLs del preference MP — BUG-010 OK; app lista para difundir, falta solo la compra real de validación con un tercero). **12.1**: cierre auto 6/7 23:59 reintroducido en `RifasApp.tsx` (`SALES_CLOSE_TS` + hard gate). (Fecha actualizada de 30/6 a 6/7 el 2026-06-12 por pedido del usuario.) **12.2**: el catálogo de combos pasó de 3 (sandwiches+empanadas) a UN único "Combo de empanadas" = 2 empanadas + gaseosa a **$12.000** (precio confirmado por directores 2026-06-12); el comprador elige N combos → reparte exactamente N×2 empanadas entre Carne / Jamón y queso con steppers de suma exacta. Persistencia: columna additive nullable `flavor_breakdown TEXT` (JSON) en `combo_purchase_items` — se eligió JSON sobre "fila por gusto" para NO tocar la semántica `quantity`=combos / `unitPrice`=$12.000, dejando el flujo de pago intacto (validado por payment-flow-debugger). ALTER aplicado a Turso prod (BD sede 2 vacía). `ComboCatalog.tsx` reescrito como picker, `ComboRow.tsx` borrado. CSV de cocina (`generar-supermercado-csv.mjs`) ahora reporta combos + empanadas por gusto. Validación E2E local OK + registros de prueba limpiados. **A continuación**: deploy + compra real de tercero, luego 12.3 (tickets) y 12.4 (talonario). Los 4 cambios originales pedidos por los directores de sede 2 vía WhatsApp. **12.1** cierre auto martes 30/6 23:59 ART (igual sede 1, gate UI hardcoded con fecha nueva). **12.2** combo de empanadas con selección de gustos: único combo = 2 empanadas + vaso de gaseosa a $15.000 (sandwiches carne/chorizo de sede 1 ELIMINADOS); el comprador elige N combos y reparte **exactamente N×2 empanadas** entre Carne y Jamón-y-queso (steppers con límite exacto); requiere columna `flavor` en `combo_purchase_items` (→ db-migration-reviewer) + reporte de cocina con totales por gusto. **12.3** impresión de tickets con el **alumno primero** (+curso) y el adulto comprador al lado (campo de alumno sigue único, sin separar apellido/nombre; el cambio es sólo en el render+orden). **12.4** talonario de rifas NO vendidas online para vender en la puerta, formato clásico (número impreso 2× con línea de corte) + branding del colegio (escudo/nombre/lema), pendiente de medidas exactas + lema. El pedido original #5 ("lista de gusto + cantidad") resultó ser el selector de gustos del combo y se fusionó en 12.2.

---

## Contexto Histórico (sede 1, evento 29/05/2026 — CERRADO)

**Save #12 el 2026-05-27 (2 días antes del evento del 29/05). La rifa CERRÓ a las 00:00 ART del 27/05**. Cifras finales: **145 orders approved, $4.798.000 recaudados** (+65 ventas y +$1.984k desde Save #11 — el último día explotó con 57 ventas y $1.609k). 720 nums vendidos de 2.000 (36%) + 272 combos (135 carne + 56 chorizo + 81 empanadas). Anti-sobreventa intacta. Breakdown método pago: 47% tarjeta crédito · 34% dinero MP · 20% débito. Producción Cloud Run revision `00020-khp` mostrando cartel "¡Gracias por participar!" + `raffles.is_active=0` en BD. Triple defensa de cierre: gate fecha hardcoded en cliente + flag BD + UPDATE manual a las 00:00:30 ART.

**4 entregables para la jefa generados en raíz del repo** (gitignored como `*.csv` y `*.pdf`): (1) `comprobantes-rifa-2026-05-27.pdf` 945 KB / 8 hojas A4 con 145 papeles formato v4 (apellido + alumno/curso + checkboxes por nums y combos + línea firma); (2) `rifa-supermercado-2026-05-27.csv` 16 KB con 145 familias + totales para el super; (3) `rifa-reporte-flor-2026-05-27.csv` 25 KB con timeline de 145 ventas + breakdown método pago para auditoría de caja; (4) `papeletas-sorteo-2026-05-27.pdf` 510 KB / 4 hojas A4 con 720 cuadraditos 15×15mm con borde dashed para recortar y meter en bolsa el día del sorteo.

**Cierre time-sensitive resuelto en 22 minutos** (de 23:37 a 23:59 ART): SalesClosedScreen.tsx nuevo + gate doble en RifasApp.tsx (`SALES_CLOSE_TS = new Date('2026-05-27T00:00:00-03:00').getTime()` evaluado por `useState` lazy initializer + setTimeout calculado con `remaining ms` para cambiar el flag al cruzar la medianoche sin requerir refresh; segundo gate `if (!raffleConfig.isActive) return <SalesClosedScreen/>` post-fetch). El HTML SSR sirve "Cargando…" como estado inicial; el JS client-side evalúa los 2 gates y renderiza el cartel instantáneo después de hidratar. Triple defensa = aunque cualquiera de los 3 caps falle, los otros 2 cubren.

**Proyecto hermano Bingo Escolar rehosteado + rebrandeado en la misma sesión** (`roddb/bingo-escolar`, repo público nuevo): rehosting desde `bingo-escolar-main/` (que estaba untracked adentro del repo rifas y rompía el stop-quality-gate de Next) a carpeta hermana `../bingo-escolar/` + Cloud Run mismo proyecto GCP. Después rebranding v2: claymorphism (estilo recomendado por `ui-ux-pro-max` para apps educativas) con paleta indigo `#4F46E5` + naranja CTA `#F97316` + Baloo 2 + escudo STA local + 6 componentes extraídos (Bolillero/Tablero/Historial/BingoModal/AudioController/ConfettiCannon) + 2 libs (colors/sounds) + físicas Framer Motion v11 (spring + custom bezier + layout animations) + canvas-confetti en 3 niveles (chico/grande/fullscreen) + Web Audio API con 3 tonos sintéticos ADSR + botón ¡BINGO! con pulse + Radix Dialog modal para registrar ganador + banner ganador efímero 30s + mute toggle persistente localStorage + `prefers-reduced-motion` global. URL: https://bingo-escolar-kc5dasqukq-ue.a.run.app (revision `bingo-escolar-00002-tgx`). Bundle 162 kB First Load.

**Caso "4 ventas post-cierre" — fue mi error de TZ**: durante la generación del reporte Flor mencioné 4 ventas (Notte/Taboada/Guitart/Brenner) que aparecían en el CSV con timestamps "00:11 / 00:28 / 00:31 / 01:18" y asumí "post-cierre". Verificación posterior cruzada Turso MCP con conversión TZ correcta: las 4 pagaron entre **21:11 y 22:18 ART del 26/05**, todas dentro del horario. Bug latente: `scripts/generar-reporte-flor.mjs` usa `datetime(updated_at, 'unixepoch', 'localtime')` pero SQLite-libsql interpretó `localtime` como UTC (el cliente Node no propagó la TZ del shell). Mejora opcional para futuro: cambiar a `datetime(updated_at, 'unixepoch', '-3 hours')` explícito.

**Fase 9 (Módulo de impresión de tickets) — REDISEÑADA en v4 (Save #11)**: el formato original "1 ticket grande recortable por número/combo con escudo header + bloque familia + footer" resultó costoso (122 hojas A4 estimadas). Tras 4 iteraciones de mockup HTML standalone en `/tmp` co-diseñadas con el usuario, se aprobó el formato **v4 — "1 papel compacto por familia"**: cada familia recibe un solo papel de ~20mm de alto con barra azul institucional + apellido (EB Garamond bold) + alumno/curso + chips con checkbox por cada número rifa (borde dorado) y cada unidad de combo (borde azul) + escudo STA chico + línea "Firma:____". El papel funciona como entregable + control de entrega: la familia se lleva el papel; el colegio tilda los checkboxes al entregar los items. **~7-8 hojas A4 para imprimir las 80 familias** (93% menos vs 122 originales). Sin `$monto`, sin `ORD-xxx`, sin fecha del sorteo (el comprobante MP ya los tiene). Combos con nombres abreviados ("S. carne", "S. chorizo", "3 empanadas") para mejor packing horizontal. Bin-packing automático del browser vía `page-break-inside: avoid` en `.papel`. Sigue local-only con guard `NODE_ENV=production → 404`. `TICKETS_PRINT_SPEC.md` queda como referencia histórica del diseño original. Lint+build verde. Pendiente solo validación visual humana (Cmd+P + impresión física del nuevo formato).

**CSV para el supermercado** generado en esta sesión: `scripts/generar-supermercado-csv.mjs` (lectura read-only via libSQL) → `rifa-supermercado-2026-05-25.csv` (gitignored). Formato Excel-friendly con BOM UTF-8 + delimitador `;`. Columnas: Order ID · Familia · Alumno/a · Curso · Cant. Números · Números · Sandwich Carne · Sandwich Chorizo · 3 Empanadas · Total combos · Total $ · Fecha pago + fila TOTAL al final. Para enviar al colegio para que sepan cuánto comprar de cada combo.

**Caso edge fuera de banda — familia Pérez Fernández** (`ORD-fewD3xzB3j`, cancelled en BD, pago real $49.000): pagaron 4 nums + 3 sandwiches de carne, pero el cron canceló el order y el bloqueo manual del 2026-05-13 solo arregló 2 nums (#572, #1707) sin re-aprobar el combo_purchase. Si la familia se presenta el día del evento, esperan +3 carne adicionales que NO están reflejados ni en los tickets ni en el CSV del super. Decisión pendiente: agregar manualmente al pedido del super o resolver inconsistencia en BD.

**Fase 7 — Carrito unificado rifa + combos (CERRADA AL 100% el 2026-05-07)**:
- **7.0 Brainstorming + spec + plan** ✅ 13 decisiones cerradas en sesión 2026-05-06. Spec `docs/superpowers/specs/2026-05-06-carrito-unificado-design.md` (556 líneas). Plan `docs/superpowers/plans/2026-05-06-carrito-unificado-fase-7.md` (3.331 líneas, 43 tasks).
- **7.A Server-side** ✅ 22 tasks, 13 commits. Schema `orders` padre + 3 ALTER TABLE en hijas (migration aplicada a Turso prod via MCP, 0 datos perdidos). `OrderService` con 5 métodos atómicos (createOrder, cancelOrder, confirmOrderPayment idempotent, removeNumberFromOrder, releaseExpiredOrders). 7 routes nuevas `/api/order/*`, 12 viejas borradas. Webhook dispatch `ORD-` + retrocompat `PUR-`/`COM-` log-only. Cron migrado. **6 fixes críticos detectados por payment-flow-debugger** (C1/C2/C3/I1/I2/I3) aplicados pre-cierre. Final review aprobado.
- **7.B UI** ✅ 11 tasks, 6 commits. OrderFlow orchestrator + 7 componentes nuevos (StickyCartBar, CartDrawer, CrossSellSheet, UnifiedBuyerForm, UnifiedReview, OrderSuccessScreen, OrderFlow) + NumberGrid multi-select cap 10 + RifasApp shell refactor. **7 componentes viejos borrados** (-742 líneas). Final reviewer detectó 1 critical (double PageContainer) + 3 important fixeados pre-cierre. Bundle home `/` 7.15 → 10.3 kB.
- **7.C Concurrency tests cross-product** ✅ 5 tasks, 2 commits. `test-concurrency.js` reescrito con 2 scenarios automatizados (overlap 2 users, 4 users overlapping con assertion real de duplicados post-fix false-green) + 2 manuales documentados (cleanup vs webhook, remove vs webhook). `simple-test.js` y `run-concurrency-test.js` borrados. concurrency-validator: ⚠️ Aprobado con observaciones — review estático insuficiente per CLAUDE.md, **gate de 7.D = correr 3x runs contra dev server con zona limpia 1990-2000**.
- **7.D Deploy + smoke automatizado** ✅ revisions 00015→00018 con 4 hot-fixes (BUG FK COM-xxx, cap removed + truncate title MP, BUG-012, fixes I-1+I-3 post-auditoría). Smoke prod E2E con URL inspection MP API verde.
- **7.E Compra real cross-product** ✅ 2026-05-07 con Rosario (esposa). $16.000 = 1 número rifa (#4) + 1 combo carne. ORD-DMA9_vLzKW · PUR-KL_U8YK_YU · COM-WOjHqoGp. MP payment 157362532623 (account_money) confirmado por webhook firmado en 29s. BD validada via Turso MCP: order/purchase/combo_purchase approved, raffle_number #4 sold, 4 events en event_logs con typeof(created_at)=integer.

**Cambios sesión 7 (resumen ejecutivo)**:
- Branch `feature/carrito-unificado` con 21 commits desde main.
- Migration aplicada a Turso productiva (additive, 0 destructive): tabla `orders` + 3 columnas `order_id` en `purchases`/`combo_purchases`/`event_logs`.
- Webhook MP ahora dispatcha `ORD-` → OrderService; `PUR-`/`COM-` legacy quedan retrocompat con log + 200.
- Cron `/api/cron/cleanup` ahora itera todas las orders pending viejas (no solo con rifa — fix C3 detectado por validator).
- 12 routes viejas borradas (`/api/purchase`, `/api/preference`, `/api/payment/*`, `/api/combo/*`).
- ComboService.ts borrado entero (lógica reimplementada inline en OrderService.createOrder).
- 7 componentes UI viejos borrados (ComboFlow, ComboBuyerForm, ComboReview, ComboSuccessScreen, PurchaseReview, BuyerForm, SuccessScreen).
- `next.config.js` sigue sin bloque `env` (lección BUG-010 respetada en createOrderPreference).

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

**Decisiones de diseño locked en sesión 7 (carrito unificado, 13 decisiones)**:
- **Q1 multi-número rifa**: cap 10 números por order. Multi-combo también.
- **Q2 entrada al sitio**: split hero mantenido (Fase 6.B intacto) + cross-sell ANTES del form único.
- **Q3 datos del comprador**: form único final adaptativo (6 campos si hasRaffle, 3 si solo combos).
- **Q4 modelo de datos**: tabla `orders` padre + `purchases`/`combo_purchases` ganaron FK nullable `order_id`. Retrocompat: legacy `order_id NULL`.
- **Q5 timeout**: cron iteraría con filtro `has_raffle=true` originalmente; **fix C3 del validator**: ahora itera TODAS las pending viejas (orders combo-only también se cancelan a 15min para no acumular basura indefinida).
- **Q6 naming**: nuevo prefijo `ORD-xxx`. Webhook dispatcha por prefijo. PUR-/COM- legacy quedan retrocompat (log + 200 silencioso, no procesan).
- **Q7 MP items**: rifa = 1 item agregado (`title:"Rifa - Números: X, Y, Z"`, quantity:1) + 1 item por tipo de combo (quantity=N). Patrón mixto reutilizado de Fase 5+6.
- **Q8 APIs**: reemplazo limpio. `/api/order/*` reemplaza las 12 routes viejas. Coexistencia rechazada.
- **Q9 carrito visible**: sticky bottom bar SIEMPRE visible cuando hay items en carrito (en todas las views except status screens). Tappable.
- **Q10 edición carrito**: bottom bar tap abre mini-carrito con × por número rifa + stepper -/+ por combo. Edits client-side pre-form, server-side post-form (DELETE /api/order/items con guard).
- **Q11 cap nums**: 10 per order.
- **Q12 cross-sell**: bottom sheet modal pre-form ("¿querés sumar X?"). Solo aparece una vez por session (gate `crossSellShown`).
- **Q13 sub-fases**: patrón fases 5/6 (A backend, B UI, C tests, D deploy).

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

### Sesión 14 — 2026-06-12 (Save #14 — Fase 12.1 + 12.2 + 12.3)
- **Resumen**: Implementación, validación y deploy de los cambios de la sede 2 pedidos por los directores. Combo de empanadas con selección de gustos (la tarea más grande), cierre automático y rediseño de tickets. App quedó lista para difundir.
- **Logros**:
  - **12.2 — Combo de empanadas $12.000 con gustos** (deployado): catálogo reducido a un único combo (sandwiches eliminados); el comprador elige N combos y reparte exactamente N×2 empanadas entre Carne y Jamón y queso (steppers de suma exacta, botón bloqueado hasta cuadrar). Schema: columna additive `flavor_breakdown` (JSON) en `combo_purchase_items` — se eligió JSON sobre "fila por gusto" para no tocar la semántica `quantity`=combos / `unitPrice`=$12.000 y dejar el flujo de pago intacto. Tocó `lib/combos.ts`, `ComboCatalog` (reescrito como picker), `OrderFlow`, `CartDrawer`, `UnifiedReview`, `OrderSuccessScreen`, `ProductSplitHero`, `CrossSellSheet`, `orderService.createOrder`, Zod route, preference MP, CSV de cocina. Revisado por `db-migration-reviewer` + `payment-flow-debugger`. Validado E2E local + smoke prod (inspección URLs preference — BUG-010 OK).
  - **12.1 — Cierre automático lunes 6/7 23:59 ART** (deployado): reintroducido `SALES_CLOSE_TS` + hard gate en `RifasApp.tsx`. (Cambió de 30/6 a 6/7 a mitad de sesión por pedido del usuario; verificado en el bundle de prod.)
  - **12.3 — Tickets alumno-primero** (local-only): bloque de identidad invertido (alumno destacado + curso, "compró: <adulto>"), orden por `studentName`, combos con desglose de gustos. Validado con render mock vía Chrome headless (4 casos).
  - Deploys: revisions `00022-hzf` (12.1+12.2) y `00023-zxz` (fecha 6/7). 5 commits a main.
- **Problemas encontrados**: ninguno (sin bugs nuevos). El order de prueba `ORD-RZh5Xh9_cr` del usuario quedó cancelado en BD por decisión suya — confirmó que el cron de timeout y la persistencia de gustos funcionan en prod.
- **Estado al cerrar**: producción en `00023-zxz`, rifa sede 2 abierta, 2000 disponibles, 0 ventas approved. Pendiente: 12.4 (talonario de no vendidas — espera medidas + lema) y compra real E2E con un tercero.

### Sesión 12 — 2026-05-27 (Cierre rifa + 4 entregables jefa + bingo rehosting + rebranding v2)
- **Duración aproximada**: ~3.5h efectivas (de ~23:30 ART del 26/05 a ~03:00 ART del 27/05).
- **Resumen**: Sesión muy diversa. Arrancó con cierre time-sensitive de la rifa a las 00:00 ART (22 min de runway), siguió con la generación de 4 entregables que pidió la jefa para el sorteo del 29/05, y terminó con la migración + rebranding completo del proyecto hermano Bingo Escolar (otro repo, mismo cluster GCP). 145 ventas finales / $4.798.000 recaudados.
- **Logros**:
  - **Cierre de ventas a las 00:00 ART**: gate doble (fecha hardcoded `SALES_CLOSE_TS` + flag BD `is_active`) + UPDATE manual a las 00:00:30 = triple defensa. Deploy revision `00020-khp` completado 17 min antes del cierre. Cartel "¡Gracias por participar!" auto-activado sin intervención humana al cruzar la medianoche. UPDATE BD aplicado vía Turso MCP.
  - **4 entregables generados**:
    - PDF comprobantes 145 familias (8 hojas A4, 945 KB, formato v4 papel-por-familia) — vía Chrome headless `--print-to-pdf` contra `/api/admin/tickets/batch` con dev local.
    - CSV super actualizado con 145 familias / 720 nums / 272 combos.
    - Reporte Flor nuevo (`scripts/generar-reporte-flor.mjs`): timeline de 145 ventas + breakdown por método de pago (47% crédito / 34% MP / 20% débito).
    - PDF papeletas sorteo nuevo (`scripts/generar-papeletas-pdf.mjs`): 720 cuadraditos 15×15mm con borde dashed para recortar y meter en bolsa.
  - **Bingo Escolar rehosting + rebranding v2** (proyecto hermano, repo público `roddb/bingo-escolar`):
    - Rehosting: mover de adentro del repo rifas a hermana + git init + push + Cloud Run mismo proyecto GCP. Deploy revision `bingo-escolar-00001-w2x`.
    - Rebranding v2 con plan aprobado en plan mode: claymorphism indigo + Baloo 2 + escudo STA local + 6 componentes extraídos + 2 libs + Framer Motion v11 springs + canvas-confetti + Web Audio API + botón BINGO con modal + banner ganador. Deploy revision `bingo-escolar-00002-tgx`.
  - **Verificación post-Save**: el usuario preguntó por las "4 ventas post-cierre" que mencioné. Verificación cruzada con Turso MCP (conversión TZ correcta) confirmó: las 4 estaban en horario (21:11-22:18 ART del 26), no después. Mi error: confusión `localtime` vs UTC en el CSV.
- **Problemas encontrados**:
  - **BUG-014** (cache stale `.next` cuando build corre con dev activo): 3a ocurrencia consecutiva. Promovido a entrada formal en BUGS.md. Workaround: matar dev + `rm -rf .next` + relanzar. Regla operativa: nunca correr build con dev activo (especialmente cuidado con stop-quality-gate hook).
  - **Stop-quality-gate falló durante el flujo**: el hook corrió `npm run build` y falló porque `bingo-escolar-main/` estaba adentro del repo rifas y Next intentaba compilarlo. Fix temporal: agregar a `tsconfig.exclude`. Fix definitivo: mover el bingo fuera del repo rifas (como hermana).
  - **Shell override `TURSO_DATABASE_URL`** apuntando a `planificador-docente`: regresión conocida del 2026-05-04 ya documentada en CLAUDE.md. Workaround: `unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN` antes de lanzar dev. Script `generar-papeletas-pdf.mjs` lo evita usando `loadEnv({ override: true })` (también ya en CLAUDE.md).
  - **Bingo deploy 1 falló**: Dockerfile `COPY /app/public ./public` fallaba porque el bingo no tenía la carpeta `public/`. Fix: `mkdir public && touch public/.gitkeep`. Deploy 2 verde.
  - **Confusión `localtime` en SQLite + Node**: el reporte Flor mostró timestamps en UTC marcados como "Fecha pago (ART)". Causa: el cliente libsql en Node no propaga la TZ del shell, entonces `localtime` cae a UTC. Mejora opcional próxima sesión: cambiar a `datetime(updated_at, 'unixepoch', '-3 hours')` explícito.
- **Decisiones de diseño / proceso tomadas**:
  - **Triple defensa para cierres time-sensitive**: gate fecha hardcoded en client + flag BD + UPDATE manual. Cada uno cubre los huecos del otro. Pattern replicable para launches/cutoffs futuros.
  - **`useState(() => Date.now() >= TS)` + setTimeout** para cruzar timestamps sin requerir refresh del usuario. React es solo cliente para esto (el SSR sirve "Cargando…", el client decide qué renderizar después).
  - **Cloud Run como hosting consistente** para apps client-side del workspace educativo (rifas + bingo + futuros). Mismo proyecto GCP, mismo billing, mismo patrón Docker. Overkill técnico (Cloudflare Pages sería más adecuado para static) pero gana en consistencia operativa para el usuario.
  - **Force push autorizado explícitamente** para sobrescribir el snapshot viejo del repo bingo (de agosto/2025 con conflict markers sin resolver). Auto-mode classifier nos pidió confirmación, usuario aprobó.
  - **Mover `bingo-escolar-main` fuera del repo rifas**: la carpeta nested causaba que Next.js de rifas intentara compilar el bingo. Fix arquitectónico correcto = hermana del rifas, no nested. Más limpio y elimina el hack `tsconfig.exclude`.
  - **Rebranding visual completo en plan mode con 4 preguntas críticas + design system de `ui-ux-pro-max`**: patrón eficiente para refactors visuales mayores. Total ~3h efectivas para 8 componentes nuevos + 1 reescrito + deploy.
- **Estado al cerrar**: producción rifas en revision `00020-khp` con cartel cierre + `is_active=0` en BD. Producción bingo en revision `bingo-escolar-00002-tgx` con rebranding completo. 4 entregables listos para imprimir/enviar a la jefa. Caso edge Pérez Fernández sigue abierto (decisión humana). Foco siguiente: evento 29/05 + post-evento decidir si quedan tareas operativas.

### Sesión 8 — 2026-05-06 (Fase 7.D deploy + 4 hot-fixes + auditoría con 4 agents)
- **Duración aproximada**: ~6h efectivas
- **Resumen**: Cierre de Fase 7 al 86%. Pre-deploy gates (3 runs concurrency + scenario 2 manual via Turso MCP) capturaron BUG FK COM-xxx en run 1 — fixeado antes del merge. Merge feature → main, 4 deploys productivos secuenciales (00015→00018) con hot-fixes durante el rollout: cap=10 removido + truncate title MP, BUG-012 created_at integer (descubierto al inspeccionar order pending real), fixes I-1 + I-3 post-auditoría. Auditoría completa con 4 agents paralelos (payment-flow-debugger + concurrency-validator + code-reviewer + db-migration-reviewer) cerrada con 0 critical y 7 important — 3 fixeados.
- **Logros**:
  - **Pre-deploy 7.D gates**: 3 runs de concurrency tests (BUG FK COM-xxx capturado y fixeado en commit `d2033e4`, runs post-fix 4/4 verdes), scenario 2 manual cleanup-vs-webhook via Turso MCP + tsx dynamic import (lock optimista verificado: webhook tardío rechazado con `order_already_cancelled` + ORDER_PAYMENT_AFTER_CANCEL severity high).
  - **Merge + Deploy 00015**: backup BD productiva pre-deploy, merge feature/carrito-unificado → main (22 commits integrados), deploy carrito unificado a Cloud Run, smoke prod automatizado con URL inspection MP API verde (lección BUG-010 cumplida — back_urls y notification_url apuntan al dominio Cloud Run).
  - **Hot-fix #1 cap=10 + truncate title MP** (commit `6c3661f`, deploy 00016): pedido del usuario "no quiero techo" → MAX_SELECTION removida en NumberGrid + Zod sin .max(10) + orderService sin guard. Riesgo MP detectado pre-deploy: title >256 chars rompe preference. Fix preventivo: truncate a "N números" si lista >200 chars. Validado E2E con orders de 30 y 50 nums.
  - **Hot-fix #2 BUG-012 created_at integer** (commit `34d111c`, deploy 00017): descubierto al inspeccionar order pending real (Rodrigo, ORD-N5U6apuSQy con 3 nums) que llevaba >40min sin cancelarse. typeof(created_at)=text confirmó string-vs-integer mismatch — el cron filtraba con integer unix epoch contra strings ISO. Fix: `createdAt: new Date()` explícito en 5 INSERTs persistentes. Validado E2E en prod: order backdated → cron cleanup `{cancelled:1, releasedNumbers:2}`.
  - **Auditoría con 4 agents paralelos** (~25min): payment-flow-debugger + concurrency-validator + code-reviewer + db-migration-reviewer. Lanzados en una sola tool call paralela para cubrir 4 ángulos distintos sin solapamiento. Output unificado: 0 critical, 7 important, 8+ minor.
  - **Hot-fix #3 I-1 + I-3 post-auditoría** (commit `8490eb9`, deploy 00018): I-1 = mismo bug FK COM-xxx replicado en branch PUR- legacy del webhook (`purchaseId: ref` con potencial FK violation si el ref no existe) → fixeado a `purchaseId: null + legacyRef en data`. I-3 = BUG-012 fix incompleto, 15 inserts a event_logs seguían en TEXT → fixeado a `createdAt: new Date()` en los 12 de orderService + 3 del webhook. Validado E2E en prod: nuevo order → event_logs.created_at con typeof=integer.
  - **Verificación viva BD via Turso MCP** post-todo: 0 active duplicates (anti-sobreventa intacta), 0 orphans en 6 FK soft-checks, 0 orders pending sin limpiar (cron BUG-012 fix funcional), 0 purchases legacy con NOT NULL en NULL.
- **Problemas encontrados**:
  - **BUG FK COM-xxx en run 1 concurrency tests** (BUG-013): event_logs.purchase_id tenía FK a purchases pero código insertaba COM-xxx (existe en combo_purchases, NO purchases). PRAGMA foreign_keys=1 en Turso hizo fallar todas las compras cross-product con SQLITE_CONSTRAINT. Diagnóstico vía payment-flow-debugger agent (3 inserts buggy detectados). Sin el gate de 3 runs, el bug llegaba a producción.
  - **BUG-012 created_at TEXT vs integer**: `default(sql\`CURRENT_TIMESTAMP\`)` con `mode:'timestamp'` integer NO funciona como esperaríamos — Drizzle solo convierte Date→integer cuando recibe el valor explícito en JS. Default SQL queda como string. Cron filter compara string vs integer y nunca matchea. Trampa silenciosa que solo se detectó con un order pending real esperando 15min de timeout.
  - **Mismo bug FK replicado en PUR- legacy**: durante la auditoría post-deploy, payment-flow-debugger detectó que el branch `if (ref.startsWith('PUR-'))` del webhook tenía `purchaseId: ref` — mismo patrón que el bug COM- ya fixeado pre-deploy. Fix preventivo, baja probabilidad de ocurrencia (legacy PUR- post-Fase 7 = casi imposible) pero defensa-en-profundidad.
  - **15 inserts event_logs con TEXT no fixeados en BUG-012 inicial**: el commit 34d111c trató el path crítico (orders + purchases + ...) pero dejó event_logs como deuda menor. db-migration-reviewer llamó la atención: aunque hoy event_logs no se filtra por edad, dashboards/reportes futuros romperían. Fix propagado a los 15.
  - **Falsa alarma raw query duplicados**: query "SELECT raffle_number_id FROM purchase_numbers GROUP BY ... HAVING COUNT(*) > 1" devolvió 9 filas. Verificación detallada confirmó 100% de las purchases involucradas están `cancelled` (histórico de tests + scenario 2). 0 active duplicates con purchases pending/approved. cancelOrder NO borra purchase_numbers (audit trail deliberado), entonces deja huérfanas — diseño esperado.
- **Decisiones de proceso**:
  - **Auditoría paralela con 4 agents en una sola tool call** funcionó muy bien para cobertura amplia post-deploy. Lanzar especialistas distintos (pago, concurrency, code, schema) sin solapamiento ahorra tiempo y reduce ruido vs un único agente generalista.
  - **Hot-fixes during deploy day** sostenibles si cada uno: lint+build verde + concurrency tests si tocan flujo + smoke E2E en prod + commit + deploy + verificación. Hicimos 4 deploys consecutivos (00015→00018) con esta disciplina y producción quedó estable.
  - **Cap UX sin techo backend**: el usuario eligió priorizar libertad del comprador sobre defensiva. Riesgo de latencia con N>50 (deuda técnica documentada).
- **Estado al cerrar**: producción en revision `00018-62z` operativa con carrito unificado, cap removido, cron funcional, anti-FK validado. Solo falta T43 (compra real $18.000 con Romi/tercero, coordinación humana). 4 issues important quedan post-launch (UI race polling, UNIQUE purchase_numbers, batch UPDATE Fase 8, refactor `tx: any`). BUGS-012 y BUG-013 documentados con causa raíz + solución + aprendizaje promovible a CLAUDE.md.

### Sesión 7 — 2026-05-06 (Fase 7 al 75%: server-side + UI + concurrency tests en feature branch)
- **Duración aproximada**: ~5h efectivas
- **Resumen**: Sesión enfocada en arrancar Fase 7 (carrito unificado rifa + combos). Cerró brainstorm + spec + plan + 3 sub-fases (7.A server-side, 7.B UI, 7.C concurrency tests) con subagent-driven-development. **Fase 7.D (deploy + smoke real) pendiente para próxima sesión** porque requiere coordinar compra real $18.000 con tercero (Romi). Branch `feature/carrito-unificado` con 21 commits, NO mergeable a main hasta validar 7.D pre-deploy.
- **Logros**:
  - **Brainstorm Fase 7** con visual companion (2 mockups: split hero options, cart visibility patterns). **13 decisiones cerradas** (multi-número cap 10, split hero mantenido + cross-sell, form único adaptativo, orders padre + hijas FK nullable, timeout cron all-orders, ORD- nuevo prefijo, MP items mixtos rifa+combos, reemplazo limpio APIs, sticky bar always-visible, mini-carrito editable, bottom sheet cross-sell, sub-fases A/B/C/D).
  - **Spec escrito** (`docs/superpowers/specs/2026-05-06-carrito-unificado-design.md`, 556 líneas) con self-review + user review.
  - **Plan escrito** (`docs/superpowers/plans/2026-05-06-carrito-unificado-fase-7.md`, 3.331 líneas, 43 tasks).
  - **Sub-fase 7.A** (22 tasks, 13 commits): schema `orders` padre + 3 ALTER en hijas + migration aplicada a Turso productiva via MCP (8 tablas finales, 0 datos perdidos), OrderService con 5 métodos atómicos + locks optimistas (createOrder, _cancelOrderInTx, confirmOrderPayment idempotent, removeNumberFromOrder, releaseExpiredOrders), 7 routes nuevas `/api/order/*`, 12 viejas borradas, webhook dispatch ORD- + retrocompat, cron migrado, ComboService.ts borrado entero (lógica reimplementada inline). **payment-flow-debugger detectó 6 issues críticos** (C1-C3 + I1-I3) en first-pass review; fixeados en commit `d8ce72f` y aprobados en re-review. Final review 7.A aprobado.
  - **Sub-fase 7.B** (11 tasks, 6 commits): OrderFlow orchestrator + 7 componentes nuevos (StickyCartBar, CartDrawer, CrossSellSheet, OrderFlow, UnifiedBuyerForm, UnifiedReview, OrderSuccessScreen) + NumberGrid multi-select cap 10 + RifasApp shell refactor + 7 componentes viejos borrados (-742 líneas). **Final code reviewer detectó 1 critical (double PageContainer en ComboCatalog) + 3 important** (precio combo hardcoded, buttons sin type, error banner Tailwind defaults) — fixeados pre-cierre en commit `809f737`. Bundle home `/` 7.15 → 10.3 kB (justificado por 7 componentes nuevos).
  - **Sub-fase 7.C** (5 tasks, 2 commits): test-concurrency.js completamente reescrito apuntando a `/api/order/*` (port 3000, zona nums 1990-2000) con 2 scenarios automatizados (overlap 2 users + 4 users overlapping con assertion real de duplicados post-fix `dfea3fb`) + 2 manuales documentados. simple-test.js + run-concurrency-test.js obsoletos borrados. concurrency-validator: ⚠️ Aprobado con observaciones — review estático insuficiente per CLAUDE.md, **gate de 7.D = correr 3x runs con dev server activo**.
- **Problemas encontrados**:
  - **6 issues críticos en orderService detectados por payment-flow-debugger** en first-pass: C1 (cancelOrder sin race detection en hijas), C2 (removeNumberFromOrder UPDATE sin guard purchaseId), C3 (releaseExpiredOrders filtraba `hasRaffle=true` dejando combo-only orders huérfanas), I1+I2 (confirmOrderPayment no diferenciaba race transitorio vs estado terminal → loop 503 con MP cuando order ya cancelled), I3 (removeNumberFromOrder al vaciar order no cancelaba hijas combo). Todos fixeados en `d8ce72f` con `_cancelOrderInTx` helper privado para reutilización. Re-review aprobado.
  - **1 critical UI en first-pass de 7.B**: `<PageContainer>` duplicado por nesting OrderFlow→ComboCatalog (combo-catalog renderizaba doble `min-h-dvh`). Fix: ComboCatalog usa Fragment cuando se monta desde OrderFlow.
  - **Scenario 4 false-green** en test-concurrency.js: el `ok('PASSED')` se ejecutaba incondicionalmente. Fix: agregar assertion real chequeando duplicados en unión de numberIds.
  - **`tx: any` en orderService**: marcado como minor pero contradice CLAUDE.md (NUNCA `any`). Aceptado como deuda técnica del patrón Drizzle tx callbacks; fix-up futuro consensuado.
  - **Test viejo apuntaba a routes borradas**: `test-concurrency.js`, `simple-test.js`, `run-concurrency-test.js` apuntaban a `/api/purchase` (borrada en T19) y port 3001. Reescritos/borrados en 7.C.
  - **Subagent-driven workflow funcionó nuevamente bien**: ~30 implementer subagents (haiku para mecánicos, sonnet para integración crítica) + 4 reviewers (db-migration ×1, payment-flow-debugger ×3, concurrency-validator ×1, code-quality ×1). 1 fix iteration en orderService (commit `d8ce72f`) + 1 fix iteration en UI 7.B (commit `809f737`) + 1 fix iteration en tests 7.C (commit `dfea3fb`). El patrón "first-pass + reviewer detecta + fix + re-review" capturó issues que sin reviewer hubieran llegado a producción.
- **Decisiones de proceso**:
  - **Final review per sub-fase con agent especializado** — payment-flow-debugger para 7.A (3 reviews: first-pass + post-fix + final), final code reviewer general-purpose sonnet para 7.B, concurrency-validator para 7.C.
  - **No-ejecutar tests live en 7.C** — el patrón de 5.B/6.B (skip sandbox smoke, validar con compra real) se mantiene; 7.D pre-deploy correrá los tests 3x contra dev server.
  - **Worktree con 21 commits sin merge a main** — Producción intacta, branch protegido para validación 7.D.
- **Estado al cerrar**: branch `feature/carrito-unificado` con 21 commits incluyendo schema migration aplicada a Turso prod (BD ya tiene 8 tablas), OrderService completo + locks optimistas + fixes detectados, UI completa rewireada, tests automatizados con assertion real. Producción en revision `00014-9wz` (pre-Fase 7) intacta. Próxima sesión arranca con 7.D: (1) 3x runs concurrency tests pre-deploy, (2) backup BD, (3) merge feature branch a main + `./scripts/deploy.sh`, (4) smoke prod automatizado con URL inspection MP API, (5) coordinar compra real cross-product $18.000 con Romi.

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
