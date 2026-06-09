# Fase 12 — Cambios pedidos por los directores de la Sede 2

> **Estado: PENDIENTE (sólo planificación + análisis, NADA producido).**
> Origen: pedidos vía WhatsApp de los directores de la sede 2 (capturados 2026-06-09) + aclaraciones del usuario.
> Contexto: el sistema ya fue reseteado y redeployado para la sede 2 (rifa id=3 "Rifa Escolar 2026 - Sede 2", revision Cloud Run `00021-fdd`, ventas abiertas, mismo MercadoPago).

## Pedidos (textual + aclaración)

1. Cerrar martes **30/6 a las 23:59**. Aclaración: **igual que sede 1** (gate de UI por fecha, client-side).
2. Combo de empanadas: elegir **cantidad de combos** + abajo elegir **gusto y cantidad de empanadas** (Carne / Jamón y queso), con la cantidad de empanadas **limitada a 2 × cantidad de combos**.
3. En la **impresión de tickets**: nombre del **alumno primero** (+ curso), al lado el **adulto** que hizo el pedido; el resto (combos + rifas) coherente con el sistema nuevo. Campo de alumno sigue **único** (formato pedido, sin separar).
4. **Talonario de rifas NO vendidas** online, para vender en la puerta. Formato talonario clásico (número impreso 2 veces con línea de corte) + branding del colegio. Esperan pasar **medidas exactas**.
5. (Era "Lista de gusta elegir y cantidad") → **se fusiona con #2**: es el selector de gustos de empanada con cantidad.

---

## T12.1 — Cierre automático martes 30/6 23:59 ART (igual que sede 1)

**Objetivo:** las ventas online se cierran solas el 2026-06-30 a las 23:59 ART, mostrando `SalesClosedScreen`.

**Enfoque (confirmado: igual que sede 1 = gate de UI hardcodeado):**
- Reintroducir en `RifasApp.tsx` la constante + gate que removí en el reset, con la fecha nueva:
  `const SALES_CLOSE_TS = new Date('2026-06-30T23:59:00-03:00').getTime();`
- Reponer: `useState(() => Date.now() >= SALES_CLOSE_TS)` + `useEffect` con `setTimeout(remaining)` para cruzar la hora sin refresh + `if (salesClosed) return <SalesClosedScreen/>` (hard gate, aparece aunque la API esté caída).
- Mantener el soft gate `is_active` (override manual vía BD) que ya está.
- **Sin** rechazo server-side (sede 1 no lo tuvo; el usuario pidió "igual que sede 1").

**Archivos:** `components/RifasApp.tsx` (revertir parcialmente el cambio del reset, con fecha 30/6).

**Validación:** lint + build; verificar que el cartel aparece al cruzar la fecha (test con fecha backdateada localmente).

**Riesgo:** bajo. Patrón ya probado en sede 1.

---

## T12.2 — Combo de empanadas con selección de gustos + cantidad (incluye ex-#5)

**Esta es la tarea más grande de la fase.** Es una feature nueva, no un cambio de label.

**Modelo de producto (CONFIRMADO 2026-06-09):**
- **Único combo de la sede 2** = **"Combo de empanadas" = 2 empanadas + vaso de gaseosa**, $15.000 (precio fijo por ahora; se actualizará cuando avisen). **Se eliminan los sandwiches de carne y chorizo de sede 1** (`lib/combos.ts` queda con un solo item).
- El comprador elige **cantidad de combos** (N). Eso le da **N × 2 empanadas**.
- Debajo elige el **gusto** de cada empanada con steppers: **Carne** y **Jamón y queso**. La suma `carne + jyq` debe ser **exactamente N × 2** (CONFIRMADO: exacta, no puede pasarse ni quedar corta — el botón continuar se habilita sólo cuando cierra exacto).
  - Ej: 1 combo (2 emp.) → {1 carne, 1 jyq} | {2 carne, 0} | {0, 2 jyq}. NO {2,1}, NO {1,0}.
  - Ej: 3 combos (6 emp.) → cualquier combinación carne+jyq que sume exactamente 6.

**UI (flujo de combo existente):**
- Hoy `lib/combos.ts` tiene 3 combos con stepper de cantidad por combo (`ComboRow`). Rediseñar a:
  - 1 stepper "Cantidad de combos" (N).
  - Bloque "Elegí los gustos" con 2 steppers (Carne / Jamón y queso) que aparece cuando N ≥ 1.
  - Contador en vivo: "Asignadas X / N×2". Deshabilitar el `+` de cada gusto cuando `carne+jyq === N×2`. Botón continuar deshabilitado hasta que la suma cierre exacto.
- Componentes afectados: `components/combos/ComboRow.tsx` (o uno nuevo `EmpanadaComboPicker`), `ComboFlow`/`OrderFlow`, el estado del carrito en `RifasApp`/`OrderFlow`, y `UnifiedReview` (mostrar el desglose de gustos).

**Modelo de datos (toca BD → pasar por `db-migration-reviewer`):**
- Hoy `combo_purchase_items` = {comboId, comboNameSnapshot, unitPrice, quantity}. No guarda gusto.
- Hay que persistir el desglose de gustos. Opciones:
  - (A) Una fila por gusto: comboId='empanadas', + nueva columna `variant`/`flavor` ('carne'|'jyq'), quantity = nº de empanadas de ese gusto. Migración additive (`ALTER TABLE combo_purchase_items ADD COLUMN flavor TEXT`).
  - (B) Columna JSON `flavor_breakdown` en `combo_purchases`.
  - Recomendado: (A), encaja con el modelo de items existente y con el reporte de cocina.
- El precio sigue ligado al **combo** (N × $15.000), NO a la empanada individual.

**MercadoPago:** el item MP describe el combo (ej. `title: "Combo empanadas x{N} (2c {carne}/{jyq})"`, quantity N, unit_price 15000). Mantener patrón actual de items mixtos.

**Reporte de cocina / super (`scripts/generar-supermercado-csv.mjs`):** ahora debe agregar totales por gusto: total empanadas carne, total empanadas jyq, total combos. Es exactamente la "lista de gusto + cantidad" que pidieron.

**Archivos:** `lib/combos.ts`, `components/combos/*` (+ posible componente nuevo), `components/order/OrderFlow.tsx`, `components/order/UnifiedReview.tsx`, `lib/services/orderService.ts` (createOrder: persistir gustos), `lib/db/schema.ts` + migración, `app/api/order/preference/route.ts` (título MP), `scripts/generar-supermercado-csv.mjs`.

**Validación:** lint+build; `db-migration-reviewer` para la migración; pruebas manuales de la restricción de cantidad (no pasarse, cierre exacto); el combo NO toca la lógica anti-sobreventa de rifa (stock ilimitado, sin race) — no requiere `concurrency-validator` salvo que se toque `orderService.createOrder` en la parte de rifa.

**Decisiones: TODAS CERRADAS (2026-06-09).** Único combo = empanadas (sandwiches eliminados); suma de gustos exacta = N×2.

---

## T12.3 — Impresión de tickets: alumno primero, adulto al lado

**Objetivo:** rediseñar el ticket impreso para que muestre primero al alumno y al lado al adulto comprador, ordenado coherentemente; resto del pedido (combos + rifas) acorde al sistema nuevo.

**Confirmado:** el campo de alumno sigue **único** (no se separa apellido/nombre en el form). Se relabela/pide formato; el cambio real es en la impresión.

**Detalle del layout (según aclaración):**
- **Alumno primero** (nombre del alumno) + **curso**. Orden de la lista de tickets: por nombre/apellido del alumno + curso.
- **Al lado**: nombre del **adulto que hizo el pedido** (el `buyerName`), mostrado en formato apellido+nombre.
- **Resto**: combos comprados (con desglose de gustos de empanada del T12.2) + números de rifa, coherente con el sistema nuevo.

**Cambios:**
- `lib/tickets/queries.ts`: hoy `orderBy(asc(orders.buyerName))` en `getAllApprovedOrderIds` y `getAdminTicketsSummary` → ordenar por `orders.studentName` (alumno). Nota: con un solo campo, el orden es por el string tal como lo cargó la familia (`asc(studentName)`); aceptable según decisión.
- `lib/tickets/render.ts`: hoy `buyerName` (familia) va arriba grande y `studentName` abajo → **invertir**: alumno arriba/primero + curso, adulto al lado/abajo. Mostrar combos con gustos.
- `app/admin/tickets/page.tsx`: orden de la tabla por alumno; columnas coherentes.
- (Coherencia con T12.2: el render de combos debe mostrar el desglose carne/jyq.)

**Archivos:** `lib/tickets/queries.ts`, `lib/tickets/render.ts`, `app/admin/tickets/page.tsx`. (Sin cambio de schema.)

**Validación:** generar PDF de prueba (Chrome headless `--print-to-pdf`) con datos de prueba y revisar layout + orden.

**Riesgo:** bajo-medio. Sólo presentación/orden.

---

## T12.4 — Talonario de rifas NO vendidas (para vender en la puerta)

**Objetivo:** generar un talonario imprimible con los números de rifa que quedaron **sin vender online**, formato talonario clásico, para venta presencial.

**Formato (según imagen de referencia del usuario):**
- Talonario clásico: cada número impreso en **dos partes** — la **colilla/talón** (queda en el talonario) y el **ticket** (se entrega al comprador), separadas por **línea de corte punteada**, con el **mismo número grande** en ambas mitades (como la foto: "274 | 274").
- Aplicar **branding del colegio**: nombre, **escudo STA**, **lema** del colegio.
- **Medidas exactas: PENDIENTE** — el usuario las va a pasar para que queden idénticas al talonario físico de referencia.

**Enfoque técnico:**
- Script nuevo `scripts/generar-talonario-novendidas.mjs` (patrón de `generar-papeletas-pdf.mjs`), query `WHERE status='available'` sobre la rifa activa.
- HTML imprimible con CSS de impresión a las medidas dadas + `page-break` correcto, número duplicado por ticket, línea dashed de corte, header con escudo+nombre+lema. PDF vía Chrome headless.

**Timing crítico:** generar **después del cierre online del 30/6** para que refleje exactamente el stock remanente y no vender en la puerta un número ya vendido online (doble venta del mismo número rifa). Si se imprime antes, hay que congelar/bloquear ese set.

**Archivos:** `scripts/generar-talonario-novendidas.mjs` (nuevo), assets de branding (`public/img/escudo-sta.png` ya existe).

**Decisiones abiertas (bloqueantes para producir):**
- Medidas exactas del talón (las pasa el usuario).
- Lema del colegio (texto exacto).
- ¿Cuántos talones por hoja A4? ¿Numeración correlativa o sólo los huecos no vendidos?

---

## Orden sugerido de ejecución

1. **T12.1 (cierre 30/6)** — urgente por fecha; trivial (revertir con fecha nueva).
2. **T12.2 (combo empanadas + gustos)** — la más grande; confirmar las 2 decisiones abiertas antes.
3. **T12.3 (impresión tickets)** — depende del desglose de gustos de T12.2 para mostrar combos.
4. **T12.4 (talonario no vendidas)** — esperar medidas + ejecutar post-cierre 30/6.

## Notas de proceso
- T12.2 toca BD (`combo_purchase_items`) → **pasar por `db-migration-reviewer`** antes de `db:generate`/`db:migrate`.
- Ninguna tarea toca la lógica anti-sobreventa de rifa (`raffleService`/`raffleNumbers`); los combos son stock ilimitado sin race. Igual correr `node run-concurrency-test.js` si se modifica `orderService.createOrder` en la rama de rifa.
- Recordatorio independiente del reviewer del reset: falta `UNIQUE INDEX` en `purchase_numbers(raffle_number_id)` como red anti-sobreventa a nivel BD.
- Deploy de cada cambio vía `./scripts/deploy.sh`; no pushear en horario de venta activa.
