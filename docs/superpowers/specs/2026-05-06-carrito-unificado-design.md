# Spec — Fase 7: Carrito unificado rifa + combos

**Fecha**: 2026-05-06
**Estado**: aprobado por usuario en brainstorming, pendiente review final del archivo escrito
**Reemplaza**: decisión "no cross-product" de Fase 6 sección 2 (revertida por pedido del usuario al cierre de Fase 6) y restricción "1 número de rifa por compra" de Fase 5.B.
**Scope**: backend + UI de un único flujo de compra que permite mezclar números de rifa y combos en una sola transacción de MercadoPago.

---

## 1. Contexto y motivación

Al cierre de Fase 6 el sitio quedó en producción (revision `00014-9wz`) con dos productos vendibles online: la rifa escolar 2026 (2.000 números a $1.000, multi-número desactivado en Fase 5.B → 1 por compra) y los combos del evento (3 combos a $15.000 c/u, multi-cantidad). La decisión vigente era "no cross-product": cada compra era de un solo tipo, dispatch por prefijo `external_reference` (`PUR-` rifa, `COM-` combo).

El usuario pidió al cierre de Fase 6 invertir esa decisión. Razón implícita: un mismo comprador (típicamente un padre) quiere apoyar el evento con varios números de rifa **y** comer durante el evento, sin tener que pasar por dos transacciones MP separadas. Esa fricción reduce la conversión de cross-sell.

Fase 7 introduce el concepto de **order**: la unidad de pago que MP procesa, que puede contener una compra de rifa, una compra de combos, o ambas. Reactiva multi-número de rifa con cap 10. Mantiene el split hero deployeado en Fase 6 como entrada (decisión cero-rework de UI), pero unifica todo el flujo posterior bajo un solo orquestador de carrito.

## 2. Decisiones de diseño

13 decisiones cerradas en brainstorming (2026-05-06):

| # | Decisión | Elegida |
|---|----------|---------|
| Q1 | Multi-número rifa habilitado, multi-combo | Sí, cap = 10 nums |
| Q2 | Entrada al sitio | **Split hero mantenido** (ProductSplitHero de Fase 6.B) + cross-sell antes del review |
| Q3 | Datos del comprador | **Form único final adaptativo**: 6 campos si hay rifa hija (buyerName + studentName + division + course + email + phone), 3 campos si solo combos (buyerName + email + phone) |
| Q4 | Modelo de datos | **Tabla `orders` padre + `purchases` y `combo_purchases` como hijas con `order_id` FK nullable**. Retrocompat: legacy `order_id=NULL` |
| Q5 | Concurrencia / timeout | **Timeout 15min solo si el order tiene hija rifa**. Si solo combos, sin timeout (decisión Fase 6 mantenida) |
| Q6 | Naming + dispatch webhook | **Nuevo prefijo `ORD-xxx`** para orders Fase 7. Retrocompat `PUR-`/`COM-` (log + 200 si llegan tardíos) |
| Q7 | Estructura items MP preference | **1 item agregado para rifa** (`title:"Rifa - Números: 5, 12, 47"`, `quantity:1`) + **1 item por tipo de combo** (`title:"Sandwich chorizo + gaseosa"`, `quantity:N`) |
| Q8 | APIs | **Reemplazo limpio**: `/api/order/*` reemplaza las 12 routes viejas (`/api/purchase/*`, `/api/combo/*`, `/api/payment/*`, `/api/preference`, `/api/combo/preference`) |
| Q9 | Visibilidad del carrito | **Sticky bottom bar siempre visible** durante toda la nav. Tappable → abre mini-carrito |
| Q10 | Edición del carrito | **Mini-carrito con `×` para quitar items + stepper para ajustar quantity de combos** |
| Q11 | Cap de números | **10** por order |
| Q12 | Estructura cross-sell | **Bottom sheet** al "Continuar" del primer producto, antes del form |
| Q13 | Sub-fases del entregable | **Mismo patrón fases 5/6**: 7.A backend, 7.B UI, 7.C concurrency tests, 7.D deploy + smoke real |

## 3. Modelo de datos

### 3.1 Diagrama

```
                ┌─────────────────────┐
                │       orders        │  ← 1 transacción MP, 1 cabecera de pago
                │   id "ORD-xxx"      │
                │   buyer fields      │
                │   total + MP IDs    │
                │   payment_status    │
                │   has_raffle bool   │  ← denormalizado para query rápida del cron
                │   has_combos bool   │
                └──────────┬──────────┘
                           │ order_id (FK nullable)
              ┌────────────┴────────────┐
              ▼                         ▼
      ┌──────────────┐         ┌──────────────────┐
      │   purchases  │         │ combo_purchases  │
      │ "PUR-xyz..." │         │ "COM-uvw..."     │
      └──────┬───────┘         └────────┬─────────┘
             │                          │
             ▼                          ▼
      ┌──────────────┐         ┌──────────────────────┐
      │ raffle_      │         │ combo_purchase_items │
      │  numbers     │         └──────────────────────┘
      └──────────────┘
```

Una order tiene 0 o 1 hija de rifa y 0 o 1 hija de combos, con la restricción de aplicación (no SQL) de que al menos una hija exista (no hay orders huérfanas). Las hijas no son polimórficas — siguen siendo `purchases` y `combo_purchases` con su semántica actual; la única diferencia post-Fase 7 es que llevan `order_id` poblado.

### 3.2 Cambios al schema

**Tabla nueva `orders`** (`lib/db/schema.ts`):

```ts
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),                                       // "ORD-xxx" (10 chars nanoid)
  buyerName: text('buyer_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),                                              // optional
  studentName: text('student_name'),                                 // poblado solo si has_raffle
  division: text('division'),                                        // poblado solo si has_raffle
  course: text('course'),                                            // poblado solo si has_raffle
  totalAmount: real('total_amount').notNull(),
  hasRaffle: integer('has_raffle', { mode: 'boolean' }).notNull(),
  hasCombos: integer('has_combos', { mode: 'boolean' }).notNull(),
  mercadoPagoPreferenceId: text('mercado_pago_preference_id'),
  mercadoPagoPaymentId: text('mercado_pago_payment_id'),
  paymentStatus: text('payment_status', {
    enum: ['pending', 'approved', 'rejected', 'cancelled']
  }).default('pending'),
  paymentMethod: text('payment_method'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});
```

**ALTER TABLE additive en hijas y event_logs**:

```sql
ALTER TABLE purchases       ADD COLUMN order_id TEXT REFERENCES orders(id);
ALTER TABLE combo_purchases ADD COLUMN order_id TEXT REFERENCES orders(id);
ALTER TABLE event_logs      ADD COLUMN order_id TEXT REFERENCES orders(id);
```

Cero datos a migrar. Las 7 cancelled legacy en `purchases` (audit trail histórico) y la rifa 2025 en backup quedan con `order_id=NULL` automáticamente.

### 3.3 Snapshot de datos del comprador

Los datos del comprador viven en `orders` como fuente de verdad. Para uniformidad con queries directas a las hijas (legacy + nuevas), `orderService.createOrder` **copia** los campos relevantes desde el order a la hija al insertarla:

- `purchases.buyerName/studentName/division/course/email/phone` ← copia de `orders` (con `studentName/division/course` notNull en `purchases` legacy → siempre poblados cuando se crea desde un order Fase 7).
- `combo_purchases.buyerName/email/phone` ← copia de `orders`.

Esta redundancia es intencional: permite mantener las queries existentes sobre las hijas sin joins, y preserva el snapshot histórico (si en el futuro un comprador cambia su nombre, las compras viejas mantienen el original).

## 4. Service layer

### 4.1 Nuevo `lib/services/orderService.ts`

API pública:

```ts
class OrderService {
  static async createOrder(data: {
    buyer: { name, email, phone?, studentName?, division?, course? },
    raffle?: { raffleId, numberIds }, // 1-10 números
    combos?: Array<{ comboId, quantity }>
  }): Promise<{ orderId, raffleChildId?, comboChildId? }>;

  static async cancelOrder(orderId: string): Promise<void>;

  static async confirmOrderPayment(
    orderId: string,
    paymentData: { mercadoPagoPaymentId?, paymentMethod? }
  ): Promise<boolean>;

  static async removeNumberFromOrder(orderId: string, numberId: number): Promise<void>;

  static async releaseExpiredOrders(): Promise<{
    cancelled: number, releasedNumbers: number
  }>;
}
```

Todas las funciones que tocan múltiples tablas se envuelven en `db.transaction()` con locks optimistas (`WHERE payment_status='pending'` en order, idem en hijas, `WHERE status='reserved' AND purchaseId=?` en `raffle_numbers`).

### 4.2 Cambios en services existentes

`raffleService.ts` y `comboService.ts`:

- Funciones `createPurchase` / `createComboPurchase` se vuelven **internas, llamadas solo desde `orderService.createOrder`** dentro de la misma transacción. Aceptan un `tx` opcional como argumento; si está presente, no abren su propia transacción.
- Funciones `confirmPayment` / `confirmComboPayment` se vuelven helpers internos de `orderService.confirmOrderPayment`. Reciben `tx` y orquestan el lock optimista en su tabla específica.
- `releaseExpiredReservations` (rifa) y la equivalente de combos se **eliminan**. El cron itera ahora `orders`, no purchases sueltas.

### 4.3 Validación server-side anti-tampering

`createOrder` y `createOrderPreference` recalculan el total server-side a partir de `raffle.pricePerNumber` (lectura BD) y `combo.price` (constante en `lib/combos.ts`), nunca confían en lo que envía el cliente. Mismo patrón que Fase 6.

## 5. API routes

### 5.1 Nuevas (7)

```
POST   /api/order/purchase          → orderService.createOrder + reserva nums
POST   /api/order/cancel            → orderService.cancelOrder
DELETE /api/order/items             → orderService.removeNumberFromOrder
POST   /api/order/preference        → createOrderPreference + persist mp_preference_id
GET    /api/order/payment/success   → callback redirect (UX only)
GET    /api/order/payment/failure   → callback redirect (UX only)
GET    /api/order/payment/pending   → callback redirect (UX only)
```

Todas con `export const dynamic = 'force-dynamic'` y `revalidate = 0` (regla CLAUDE.md). Validación de payload con Zod. Total recalculado server-side. Respuestas con shape `{ success, data?, error? }`.

### 5.2 Borradas (12)

```
/api/purchase, /api/purchase/cancel
/api/preference
/api/payment/{success,failure,pending,confirm,cancel}
/api/combo/purchase, /api/combo/cancel
/api/combo/preference
/api/combo/payment/{success,failure,pending}
```

Las routes son internas (consumidas solo por el frontend del propio repo). Cero clientes externos. Borrado seguro.

### 5.3 Mantenidas

```
/api/numbers              ← grilla (sin cambios)
/api/numbers/verify       ← validación pre-reserva (sin cambios)
/api/raffle/config        ← configuración rifa (sin cambios)
/api/cron/cleanup         ← refactor interno (llama orderService.releaseExpiredOrders)
/api/webhooks/mercadopago ← refactor interno (dispatch ORD- agregado)
/api/test/reset-numbers   ← solo dev (sin cambios)
```

## 6. MercadoPago integración

### 6.1 `createOrderPreference` en `lib/mercadopago.ts`

Reemplaza a `createPreference` (rifa) y `createComboPreference` (combos), que se eliminan.

```ts
function createOrderPreference(args: {
  orderId: string,        // "ORD-xxx" → external_reference
  raffle?: { raffleTitle, numbers: number[], pricePerNumber },
  combos?: Array<{ comboNameSnapshot, unitPrice, quantity }>,
  buyer: { email, name, phone? },
}): Promise<{ id, init_point, sandbox_init_point }>;
```

Items resultantes (Q7 A):

- Si hay `raffle`: `{ title: "Rifa Escolar 2026 - Números: 5, 12, 47", quantity: 1, unit_price: pricePerNumber * numbers.length, currency_id: "ARS" }`.
- Si hay `combos`: para cada `combos[i]`, `{ title: "${comboNameSnapshot}", quantity: combos[i].quantity, unit_price: combos[i].unitPrice, currency_id: "ARS" }`.

Otros campos de la preference:

- `external_reference`: `orderId` (`ORD-xxx`).
- `description`: `"STA - ${orderId} - ${nNums} nums + ${nCombos} combos"` (visible en comprobante MP).
- `notification_url`: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/mercadopago` (lección BUG-010 — runtime env, no inline en `next.config.js`).
- `back_urls`: success/failure/pending apuntan a `/api/order/payment/{success,failure,pending}` con dominio `NEXT_PUBLIC_BASE_URL`.
- Sin `auto_return` (lección 2026-05-04: SDK v2.0.15 bug).

### 6.2 Webhook dispatch (`app/api/webhooks/mercadopago/route.ts`)

Después del verify HMAC + `getPaymentInfo` (sin cambios), el handler chequea `paymentInfo.external_reference`:

```ts
const ref = paymentInfo.external_reference;

if (ref.startsWith('ORD-')) {
  await handleOrderPayment(ref, paymentInfo);
  return 200;
}
if (ref.startsWith('PUR-')) {
  // Retrocompat: webhook tardío legacy. Log + 200, no procesar.
  console.warn(`Legacy PUR- webhook received post-Fase 7: ${ref}`);
  await db.insert(eventLogs).values({
    eventType: 'LEGACY_PUR_WEBHOOK_IGNORED',
    purchaseId: ref,
    data: JSON.stringify({ paymentInfo })
  });
  return 200;
}
if (ref.startsWith('COM-')) {
  console.warn(`Legacy COM- webhook received post-Fase 7: ${ref}`);
  await db.insert(eventLogs).values({
    eventType: 'LEGACY_COM_WEBHOOK_IGNORED',
    purchaseId: ref,
    data: JSON.stringify({ paymentInfo })
  });
  return 200;
}

// Unknown ref
console.error(`UNKNOWN_REFERENCE webhook: ${ref}`);
return 200;
```

`handleOrderPayment` llama a `orderService.confirmOrderPayment` o `cancelOrder` según `paymentInfo.status`. Idempotencia + locks optimistas idénticos al patrón actual de `confirmPayment`. Errores transitorios → throw → 503 → MP reintenta.

## 7. Cron cleanup

`/api/cron/cleanup` invoca `orderService.releaseExpiredOrders`:

```ts
const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

const expiredOrders = await db.select().from(orders)
  .where(and(
    eq(orders.paymentStatus, 'pending'),
    eq(orders.hasRaffle, true),
    lte(orders.createdAt, fifteenMinutesAgo)
  ));

for (const order of expiredOrders) {
  await this.cancelOrder(order.id);
  // cancelOrder es atómico: cancela order + hijas + libera nums
}
```

Orders con `hasRaffle=false` (solo combos) **no entran al cleanup** (Q5 A — combos sin timeout). Si quedan abandonadas, se limpian manualmente vía panel admin (5.C, fuera de scope Fase 7).

`CRON_SECRET` en `--set-secrets` del deploy script (preservado por fix BUG-011).

## 8. UI flow

### 8.1 Flujo end-to-end

```
[Home con ProductSplitHero] (Q2 B — sin cambios visuales)
   │
   ├──→ tap "Rifa"  ──→ [grid multi-select 1-10 nums]      ┐
   └──→ tap "Combo" ──→ [catalog stepper rows]              ┤
                                                            ▼
                              [tap "Continuar"]
                                       │
                                       ▼
                       [Bottom sheet cross-sell] (Q12 C)
                       "¿Querés sumar [el otro producto]?"
                       [Sí, agregar X] [No, seguir al pago]
                                       │
                       ┌───────────────┴───────────────┐
                       │ Sí                          No│
                       ▼                               │
              [Selección del segundo producto]         │
              (con sticky bottom bar mostrando mix)    │
                       │                               │
                       │ tap "Continuar"               │
                       └───────────────┬───────────────┘
                                       ▼
                       [Form único adaptativo] (Q3 A)
                       - 6 campos si hasRaffle
                       - 3 campos si solo combos
                                       │
                                       ▼
                       [Review unificado]
                       - Breakdown rifa + combos
                       - Total + datos comprador
                       - "Pagar con MP"
                                       │
                                       ▼
                              [Redirect MP]
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
                  [Success]       [Failure]       [Pending]
```

**Sticky bottom bar** (Q9 A) visible en todas las pantallas excepto home, form y review (que ya muestran su propio contenido). Tappable → abre `CartDrawer` con mini-carrito editable (Q10 B).

### 8.2 Componentes nuevos

```
components/
  cart/
    StickyCartBar.tsx          ← bottom bar tappable, count + total + chevron
    CartDrawer.tsx             ← bottom sheet con items rifa (×) + combos (-/+/×) + total
  cross-sell/
    CrossSellSheet.tsx         ← bottom sheet "¿querés sumar X?" pre-form
  order/
    OrderFlow.tsx              ← orchestrator que maneja view state, cart, buyer, orderId
    UnifiedBuyerForm.tsx       ← 6 o 3 campos según hasRaffle
    UnifiedReview.tsx          ← breakdown items rifa + combos + total + buyer + CTA pagar
    OrderSuccessScreen.tsx     ← success genérico que acepta order completo
```

### 8.3 Componentes refactoreados

- `components/RifasApp.tsx`: pasa de coordinar 3 views (home, rifa, combo) a delegar a `<OrderFlow>` después del split hero.
- `components/grid/NumberGrid.tsx`: pasa de single-select a multi-select hasta cap=10. Cell con check icon. Header "X/10 seleccionados".
- `components/combos/ComboCatalog.tsx` + `ComboRow.tsx`: sin cambios funcionales, pero se integran al `<OrderFlow>` (no llaman directo a `/api/combo/*`).
- `components/status/FailureScreen.tsx` + `PendingScreen.tsx`: ya tienen `productType?` (Fase 6.B T17). Se aprovecha con `productType: 'order'` y copy genérico.

### 8.4 Componentes eliminados

- `components/combos/ComboFlow.tsx` → reemplazado por `OrderFlow.tsx`
- `components/combos/ComboBuyerForm.tsx` → reemplazado por `UnifiedBuyerForm.tsx`
- `components/combos/ComboReview.tsx` → reemplazado por `UnifiedReview.tsx`
- `components/status/ComboSuccessScreen.tsx` → reemplazado por `OrderSuccessScreen.tsx`
- `components/review/PurchaseReview.tsx` → reemplazado por `UnifiedReview.tsx`
- `components/form/BuyerForm.tsx` → reemplazado por `UnifiedBuyerForm.tsx`
- `components/status/SuccessScreen.tsx` → reemplazado por `OrderSuccessScreen.tsx`

### 8.5 Componentes mantenidos sin tocar

- `components/hero/ProductSplitHero.tsx`
- `components/layout/{PageContainer,AppHeader,StickyBottomBar}.tsx`
- `components/grid/{NumberCell,GridLegend,NumberSearch,RangeTabs}.tsx`
- `components/form/{FormField,StudentBlock}.tsx`

### 8.6 State del OrderFlow

```ts
{
  view: 'splash' | 'rifa-grid' | 'combo-catalog' | 'cross-sell-sheet' |
        'form' | 'review' | 'success' | 'failure' | 'pending',
  cart: {
    raffleId: number,
    raffleNumbers: number[],         // 0-10
    combos: Array<{ comboId, quantity }>,  // 0+ tipos
  },
  buyer: { name, email, phone?, studentName?, division?, course? },
  orderId?: string,                   // creado al "Continuar" del form
  reservationLockedAt?: Date,         // para countdown UI
  isLoading: boolean,
  error?: string,
}
```

Polling cada 30s sobre `/api/numbers` para detectar si los números del cart fueron liberados (defense-in-depth, raro porque están reservados a nuestro nombre — pero cobertura del edge case race con cancel manual).

## 9. Concurrencia

### 9.1 Invariantes preservados

Los invariantes anti-sobreventa son los mismos que pre-Fase 7, escalados al nivel de order:

- **No dos compras con el mismo número en `sold`**: garantizado por `UPDATE raffle_numbers SET status='sold' WHERE id=? AND status='reserved' AND purchaseId=?` con check `rowsAffected===N`. Sin cambios.
- **Transición forzada `available → reserved → sold`**: sin cambios.
- **Reservas expiran en 15min**: el cron itera orders con `has_raffle=true AND created_at < NOW-15min`, llama `cancelOrder` que internamente sigue el mismo lock pattern sobre `raffle_numbers`.

### 9.2 Edge cases nuevos

- **Race entre `removeNumberFromOrder` (mini-carrito Q10 B) y `confirmOrderPayment` (webhook)**: `removeNumberFromOrder` lleva guard `WHERE order.payment_status='pending'`. Si pasa a `approved` antes, el remove falla con mensaje "tu pago ya se procesó" y la UI muestra el order como completado. El webhook gana.
- **Race cleanup (cron) vs webhook (MP) sobre el mismo order**: igual que pre-Fase 7 sobre purchases. Locks optimistas en order + hijas + raffle_numbers garantizan consistencia. Log `PAYMENT_CONFLICT` en `event_logs` con `orderId`.
- **Cross-sell parcial**: si elegiste 3 nums hace 5min, cruzaste a combos por 2min, volviste, los nums están reservados a tu nombre. No requiere re-validación porque el `WHERE status='available'` solo se aplica en `createOrder`, no en cross-sell.

### 9.3 Atomicidad de `createOrder`

```ts
return await db.transaction(async (tx) => {
  // 1. INSERT orders
  await tx.insert(orders).values({ id: orderId, ... });

  // 2. Si hay rifa: reservar nums + INSERT purchases hija
  if (data.raffle) {
    const reserved = await raffleService.reserveAndCreatePurchase({
      tx, orderId, raffleId, numberIds, buyer
    });
    // reserveAndCreatePurchase hace UPDATE raffle_numbers WHERE status='available'
    // y verifica rowsAffected === numberIds.length, throw si no.
  }

  // 3. Si hay combos: INSERT combo_purchases hija + items
  if (data.combos) {
    await comboService.createComboPurchase({ tx, orderId, items: combos, buyer });
  }

  return { orderId, raffleChildId?, comboChildId? };
});
```

Si cualquier paso falla (ej: número ya reservado por otro user), throw → la transacción rollbackea TODO → cero filas inconsistentes. Comportamiento idéntico al pre-Fase 7 pero a nivel order.

## 10. Migración a producción

### 10.1 Pre-deploy

1. **Backup BD productiva** vía Turso MCP `SELECT *` de las 7 tablas → JSON gitignored en `backups/rifa-2026-pre-fase7-YYYY-MM-DD.json`.
2. **`db-migration-reviewer`** valida la migration generada por `drizzle-kit generate` antes de aplicar.
3. **Aplicación de migration** vía Turso MCP especificando explícitamente `database='sistema-de-riffas'` (lección Fase 6 — drizzle-kit push se conectó a BD equivocada por shell env contaminado).
4. **Verificación post-migration**: `SELECT name FROM sqlite_master WHERE type='table'` → 8 tablas (4 rifa + 2 combo + 1 orders + 1 event_logs). Las 7 cancelled legacy intactas con `order_id IS NULL`.

### 10.2 Deploy

1. **Capturar revision rollback target**: `sistema-ventas-rifas-00014-9wz`.
2. **`./scripts/deploy.sh`** build + deploy. `CRON_SECRET` preservado en `--set-secrets` (fix BUG-011).
3. **Smoke prod automatizado** (sin user action):
   - Home HTTP 200, split hero render OK.
   - `/api/order/purchase` con bot data → 200 OK + `orderId`.
   - `/api/order/preference` → response 200 + `initPoint` Y **inspección de URLs internas vía MP API**: `curl -H "Authorization: Bearer $MP_TOKEN" https://api.mercadopago.com/checkout/preferences/{id}` → assert `back_urls.success/failure/pending` y `notification_url` empiezan con `https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app` (lección BUG-010 — sin esta verificación, un bug de config queda oculto hasta compra real).
   - `/api/cron/cleanup` con auth → 200; sin auth → 401 (no regresión BUG-011).
   - `/api/webhooks/mercadopago` con firma inválida → 401; con firma válida + `ORD-fake` + paymentId ficticio → 503 (retry policy MP).
4. **Cleanup BD post-smoke**: borrar el order de smoke vía Turso MCP en orden FK-safe (DELETE event_logs → DELETE purchase_numbers/combo_purchase_items → UPDATE raffle_numbers a available → DELETE purchases/combo_purchases → DELETE orders).
5. **Smoke real cross-product** con tercero (Romi probablemente, no Rodrigo por seller=buyer): 3 nums + 1 combo = $18.000. Cierra ciclo end-to-end.

### 10.3 Rollback

Si Fase 7 sale rota a producción:

- **Frontend + Backend**: revert del merge a main + redeploy. Cloud Run vuelve a revision target `00014-9wz` con APIs viejas activas.
- **BD**: la migration es additive (CREATE TABLE + 3 ALTER TABLE ADD COLUMN). No es destructive. Las nuevas tablas y columnas pueden quedar sin uso post-rollback; limpieza opcional en sesión separada.

## 11. Tests

### 11.1 Unit tests

- `tests/order-service.test.mjs` — TDD primero. Cubre: createOrder solo-rifa, solo-combos, cross-product, cancel, confirm idempotente, removeNumberFromOrder, releaseExpiredOrders.
- `tests/combos.test.mjs` (existente) — sin cambios.
- `tests/webhook-verification.test.mjs` (existente) — sin cambios.

### 11.2 Concurrency tests (sub-fase 7.C)

Extender `test-concurrency.js` y `run-concurrency-test.js` con 4 escenarios cross-product:

1. **2 users overlapping nums + cross-product**: A=[5,12]+2 sandwiches vs B=[5,13]+1 empanada. Esperado: A approved con 2 nums + combos, B con error claro y sin reserva.
2. **Cleanup mientras se paga cross-product**: A crea order con [5,12]+1 combo a t=0. Cron a t=15min cancela. Webhook approved a t=15min+30s. Esperado: estado consistente — uno solo gana, sin inconsistencias.
3. **removeNumberFromOrder mientras webhook procesa**: A tap × en #12 mientras webhook está procesando. Esperado: una sola escritura gana, sin estados huérfanos.
4. **4 users overlapping cross-product**: A=[1,2,3]+2 combos, B=[3,4,5]+1 combo, C=[5,6,7]+0 combos, D=[]+3 combos. Esperado: 0 sobreventa en raffle_numbers, 4 orders en estado consistente.

**Gate**: 4/4 nuevos verdes + tests pre-existentes verdes. Sin esto NO se avanza a 7.D.

## 12. Sub-fases del entregable

| # | Scope | Validación | Gate de salida |
|---|-------|------------|----------------|
| **7.0** | Spec aprobado + plan escrito | Self-review + user review | Esta sesión |
| **7.A** | Schema + migration + orderService + 6 routes nuevas + webhook ORD- + cron refactor + unit tests | `npm run lint && build`; `db-migration-reviewer` aprueba; `payment-flow-debugger` confirma cero regresión rifa pura | Sub-fase aprobada por reviewer; producción intacta (no deploy aún) |
| **7.B** | OrderFlow + 6 componentes nuevos + 7 borrados + 5 refactoreados + multi-select | Build, lint; smoke local con dev server: recorrer flow completo con bot data | Final code reviewer aprueba; flow E2E manual verde |
| **7.C** | Tests concurrencia cross-product (4 escenarios) | `node run-concurrency-test.js` con dev server | 4/4 nuevos + pre-existentes 100% verdes |
| **7.D** | Deploy Cloud Run + smoke prod automatizado (incluye MP API URL inspection) + smoke real cross-product con tercero | Backup + db-migration-reviewer + smoke prod + compra real $18.000 | Order approved en BD + raffle_numbers sold + combo_purchase approved + comprobante MP recibido |

**Workflow per sub-fase**: subagent-driven con haiku para tasks mecánicas (tipos `feature/orden-` worktree branch), sonnet para integración (orderService, webhook dispatch, OrderFlow). Reviewers (`db-migration-reviewer`, `payment-flow-debugger`, `concurrency-validator`) en gates críticos.

## 13. Fuera de scope

Items pendientes ortogonales a Fase 7:

- **5.E logo STA + hex institucionales**: pendiente del usuario (no bloquea Fase 7).
- **5.C panel admin con basic auth + 3 tabs + export CSV**: pendiente, ortogonal.
- **Cleanup orders pending solo-combos sin pagar**: convención manual via admin panel (post-5.C).
- **Auditoría retroactiva del histórico cancelled legacy**: las 7 quedan con `order_id=NULL`. Sin acción especial.
- **Restaurar rifa 2025**: si en algún momento se restaura desde backup, las purchases legacy quedan con `order_id=NULL`. Compatible con el nuevo modelo.

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Migration aplicada a BD equivocada (lección Fase 6) | Aplicar via Turso MCP especificando `database='sistema-de-riffas'`, no drizzle-kit push |
| Bug `next.config.js env` repite hardcode de URLs (BUG-010) | NO usar bloque `env` para `NEXT_PUBLIC_*` con fallback localhost. URLs derivan runtime de `process.env`. |
| Smoke prod automatizado pasa pero compra real falla (BUG-010 redux) | El smoke prod **inspecciona URLs internas del preference vía MP API** (no solo `200 + initPoint`) |
| Race entre cron y webhook con order cross-product | Locks optimistas idénticos al patrón rifa pura, escalados a order. Test de concurrencia 7.C cubre el escenario. |
| `removeNumberFromOrder` deja BD inconsistente | Guard `WHERE order.payment_status='pending'`. Si paso a `approved`, falla silenciosamente. Test de concurrencia 7.C cubre. |
| APIs viejas se borraron pero algún cliente externo las llama | Cero clientes externos (rutas internas frontend). Verificado en exploración inicial Fase 7. |
| Webhook MP tardío legacy llega y se procesa accidentalmente | Dispatch valida prefijo `ORD-` antes de tocar BD. `PUR-`/`COM-` legacy → log + 200, no procesan. |
| `CRON_SECRET` se vuelve a perder en deploy | Fix BUG-011 ya aplicado. Smoke prod 7.D verifica `/api/cron/cleanup` 401 sin auth. |

---

## Apéndice: Resumen de archivos afectados

**Schema** (`lib/db/schema.ts`): +tabla `orders`, +`order_id` en `purchases` y `combo_purchases` y `event_logs`.

**Drizzle**: `drizzle/0001_*.sql` generado por `drizzle-kit generate`. Aplicado vía Turso MCP.

**Services**:
- `lib/services/orderService.ts` (nuevo, ~400 líneas)
- `lib/services/raffleService.ts` (refactor: funciones internas reciben `tx`, eliminada `releaseExpiredReservations`)
- `lib/services/comboService.ts` (refactor: idem)
- `lib/combos.ts` (sin cambios)

**MercadoPago** (`lib/mercadopago.ts`):
- `+createOrderPreference`
- `-createPreference`, `-createComboPreference`

**Routes** (en `app/api/`):
- 7 nuevas en `order/` (purchase, cancel, items DELETE, preference, payment/{success,failure,pending})
- 12 borradas (`purchase/`, `payment/`, `preference/`, `combo/`)
- `/api/webhooks/mercadopago/route.ts` refactor dispatch
- `/api/cron/cleanup/route.ts` refactor interno

**Frontend** (`components/`):
- 6 nuevos: `cart/StickyCartBar`, `cart/CartDrawer`, `cross-sell/CrossSellSheet`, `order/OrderFlow`, `order/UnifiedBuyerForm`, `order/UnifiedReview`, `order/OrderSuccessScreen`
- 7 borrados (ver §8.4)
- 5 refactoreados: `RifasApp`, `NumberGrid`, `ComboCatalog`/`ComboRow`, `FailureScreen`, `PendingScreen`

**Tests**:
- `tests/order-service.test.mjs` (nuevo)
- `test-concurrency.js` y `run-concurrency-test.js` (extendidos con 4 escenarios)

**Docs/Config**:
- `ESTADO.md`, `MEMORIA.md`, `BUGS.md`, `LEARNINGS.md` actualizados al cierre de cada sub-fase
- `scripts/deploy.sh` sin cambios (BUG-011 ya fixeado)
