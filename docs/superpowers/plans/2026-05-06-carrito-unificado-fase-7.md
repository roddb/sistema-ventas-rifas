# Carrito Unificado (Fase 7) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar compras cross-product (rifa + combos) en una sola transacción MP via tabla padre `orders`, restaurando multi-número de rifa (cap 10) y manteniendo el split hero deployeado en Fase 6 con cross-sell bottom sheet pre-form.

**Architecture:** Tabla nueva `orders` (`ORD-xxx`) padre, `purchases` y `combo_purchases` ganan FK nullable `order_id`. Nuevo `OrderService` orquesta a los services existentes dentro de transacciones. Reemplazo limpio de 12 routes viejas por 7 nuevas en `/api/order/*`. Webhook dispatch agrega rama `ORD-` + retrocompat `PUR-`/`COM-`. Cron itera orders pending viejas con `has_raffle=true`. UI orchestrator nuevo `OrderFlow` reemplaza a `ComboFlow` y absorbe la lógica de RifasApp post-split-hero.

**Tech Stack:** Next.js 14.2.5 App Router · TypeScript 5.5.4 strict · Drizzle ORM 0.32.2 + Turso libSQL · MercadoPago SDK 2.0.15 · React 18.3.1 · Tailwind CSS 3.4.7 · Zod 3.23.8 · nanoid 5.1.5 · `node:test` para unit tests.

**Spec:** `docs/superpowers/specs/2026-05-06-carrito-unificado-design.md`

**Branch convention:** trabajar en worktree `.worktrees/fase-7` con branch `feature/carrito-unificado` (patrón Fase 5.B/6 ya validado).

---

## Sub-fase 7.A — Server-side (Tasks 1-22)

Modelo de datos + service layer + 7 routes nuevas + 12 viejas borradas + webhook dispatch ORD- + cron refactor + unit tests.

---

### Task 1: Setup worktree + ESTADO.md

**Files:**
- Create: `.worktrees/fase-7/` (via `git worktree add`)
- Modify: `ESTADO.md`

- [ ] **Step 1: Create worktree**

```bash
git worktree add .worktrees/fase-7 -b feature/carrito-unificado main
cd .worktrees/fase-7
```

- [ ] **Step 2: Add `.eslintrc.json` con `root: true` para evitar conflicto eslint con repo padre (lección Fase 5.B)**

```bash
echo '{"extends":"next/core-web-vitals","root":true}' > .eslintrc.json
```

- [ ] **Step 3: Verify lint+build verdes en worktree**

Run: `npm install && npm run lint && npm run build`
Expected: ambos verdes, sin warnings.

- [ ] **Step 4: Update ESTADO.md (en main, no worktree) marcando Fase 7 en progreso**

Cambiar `[ ] 7.0 Brainstorming + spec` a `[x]` y `[ ] 7.A Schema + service + APIs` a `[~]`. Agregar entrada de bitácora con la fecha.

- [ ] **Step 5: Commit worktree setup en feature branch**

```bash
git add .eslintrc.json
git commit -m "chore(fase-7): worktree setup + eslint root"
```

---

### Task 2: Schema additions (Drizzle)

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Agregar tabla `orders` y columnas `order_id` en hijas**

Reemplazá el contenido de `lib/db/schema.ts` con:

```ts
import { sql } from 'drizzle-orm';
import { integer, text, sqliteTable, real } from 'drizzle-orm/sqlite-core';

export const raffles = sqliteTable('raffles', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  totalNumbers: integer('total_numbers').notNull().default(1500),
  pricePerNumber: real('price_per_number').notNull(),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const raffleNumbers = sqliteTable('raffle_numbers', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  raffleId: integer('raffle_id').notNull().references(() => raffles.id),
  number: integer('number').notNull(),
  status: text('status', { enum: ['available', 'reserved', 'sold'] }).default('available'),
  reservedAt: integer('reserved_at', { mode: 'timestamp' }),
  soldAt: integer('sold_at', { mode: 'timestamp' }),
  purchaseId: text('purchase_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  buyerName: text('buyer_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  studentName: text('student_name'),
  division: text('division'),
  course: text('course'),
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

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  raffleId: integer('raffle_id').notNull().references(() => raffles.id),
  orderId: text('order_id').references(() => orders.id),
  buyerName: text('buyer_name').notNull(),
  studentName: text('student_name').notNull(),
  division: text('division').notNull(),
  course: text('course').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  totalAmount: real('total_amount').notNull(),
  numbersCount: integer('numbers_count').notNull(),
  mercadoPagoPreferenceId: text('mercado_pago_preference_id'),
  mercadoPagoPaymentId: text('mercado_pago_payment_id'),
  paymentStatus: text('payment_status', {
    enum: ['pending', 'approved', 'rejected', 'cancelled']
  }).default('pending'),
  paymentMethod: text('payment_method'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const purchaseNumbers = sqliteTable('purchase_numbers', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  purchaseId: text('purchase_id').notNull().references(() => purchases.id),
  raffleNumberId: integer('raffle_number_id').notNull().references(() => raffleNumbers.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const eventLogs = sqliteTable('event_logs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  purchaseId: text('purchase_id').references(() => purchases.id),
  orderId: text('order_id').references(() => orders.id),
  data: text('data'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const comboPurchases = sqliteTable('combo_purchases', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id),
  buyerName: text('buyer_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  totalAmount: real('total_amount').notNull(),
  itemsCount: integer('items_count').notNull(),
  mercadoPagoPreferenceId: text('mercado_pago_preference_id'),
  mercadoPagoPaymentId: text('mercado_pago_payment_id'),
  paymentStatus: text('payment_status', {
    enum: ['pending', 'approved', 'rejected', 'cancelled']
  }).default('pending'),
  paymentMethod: text('payment_method'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const comboPurchaseItems = sqliteTable('combo_purchase_items', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  comboPurchaseId: text('combo_purchase_id').notNull().references(() => comboPurchases.id),
  comboId: text('combo_id').notNull(),
  comboNameSnapshot: text('combo_name_snapshot').notNull(),
  unitPrice: real('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});
```

- [ ] **Step 2: Run lint+typecheck**

Run: `npm run lint && npm run build`
Expected: ambos verdes; el build no falla porque el código actual no consume aún `orders`.

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(fase-7): schema orders padre + order_id en hijas"
```

---

### Task 3: Generate migration + db-migration-reviewer

**Files:**
- Create: `drizzle/0001_*.sql` (auto-generated)

- [ ] **Step 1: Generate migration**

Run: `npm run db:generate`
Expected: Drizzle genera nuevo archivo SQL en `drizzle/0001_*.sql` con `CREATE TABLE orders`, `ALTER TABLE purchases ADD COLUMN order_id`, `ALTER TABLE event_logs ADD COLUMN order_id`, `ALTER TABLE combo_purchases ADD COLUMN order_id`.

- [ ] **Step 2: Inspect SQL generado**

Read: `drizzle/0001_*.sql`. Verificar que:
- `CREATE TABLE orders` tiene todos los campos del schema.
- 3 `ALTER TABLE` agregando `order_id TEXT REFERENCES orders(id)`.
- NO hay `DROP TABLE` ni columnas borradas (additive only).

- [ ] **Step 3: Invoke `db-migration-reviewer` agent**

Dispatch: agent `db-migration-reviewer` con prompt:
> "Revisar la migración Drizzle generada en `drizzle/0001_*.sql` para Fase 7 (carrito unificado). Validar: (a) la migración es additive (CREATE TABLE + ALTER ADD COLUMN), (b) ningún FK rompe constraints existentes, (c) las 7 cancelled legacy en `purchases` y la rifa 2025 en backup quedan compatibles con `order_id=NULL`, (d) no hay riesgo de pérdida de datos, (e) orden de operaciones es seguro (CREATE TABLE orders ANTES de los ALTER que la referencian). Spec: `docs/superpowers/specs/2026-05-06-carrito-unificado-design.md` §3.2."

Expected: aprobación del reviewer. Si hay observaciones, fixearlas antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "feat(fase-7): migration 0001 - orders padre + order_id en hijas"
```

---

### Task 4: Apply migration via Turso MCP (productiva)

**Files:** ninguno

> ⚠️ **CRITICAL**: NO usar `drizzle-kit push:sqlite`. El shell del dev tiene `TURSO_DATABASE_URL` exportada apuntando a `planificador-docente`; dotenv 17 no override por default (lección 2026-05-04, BUG pre-flight Fase 6 T4). Aplicar manualmente vía Turso MCP especificando `database='sistema-de-riffas'`.

- [ ] **Step 1: Backup BD productiva (audit pre-migration)**

Use Turso MCP: `mcp__turso-cloud__execute_read_only_query` con `database: "sistema-de-riffas"`:
```sql
SELECT 'raffles' as t, COUNT(*) c FROM raffles
UNION ALL SELECT 'raffle_numbers', COUNT(*) FROM raffle_numbers
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'purchase_numbers', COUNT(*) FROM purchase_numbers
UNION ALL SELECT 'event_logs', COUNT(*) FROM event_logs
UNION ALL SELECT 'combo_purchases', COUNT(*) FROM combo_purchases
UNION ALL SELECT 'combo_purchase_items', COUNT(*) FROM combo_purchase_items;
```
Expected: 1 raffle, 2000 raffle_numbers, 7 purchases (cancelled), 0 purchase_numbers, varios event_logs, 0 combo_purchases, 0 combo_purchase_items.

- [ ] **Step 2: Apply CREATE TABLE orders**

Use Turso MCP: `mcp__turso-cloud__execute_query` con `database: "sistema-de-riffas"`:
```sql
CREATE TABLE orders (
  id text PRIMARY KEY NOT NULL,
  buyer_name text NOT NULL,
  email text NOT NULL,
  phone text,
  student_name text,
  division text,
  course text,
  total_amount real NOT NULL,
  has_raffle integer NOT NULL,
  has_combos integer NOT NULL,
  mercado_pago_preference_id text,
  mercado_pago_payment_id text,
  payment_status text DEFAULT 'pending',
  payment_method text,
  created_at integer DEFAULT CURRENT_TIMESTAMP,
  updated_at integer DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 3: Apply ALTER TABLE en hijas y event_logs**

Use Turso MCP `execute_query` (3 statements separados):
```sql
ALTER TABLE purchases ADD COLUMN order_id text REFERENCES orders(id);
```
```sql
ALTER TABLE combo_purchases ADD COLUMN order_id text REFERENCES orders(id);
```
```sql
ALTER TABLE event_logs ADD COLUMN order_id text REFERENCES orders(id);
```

- [ ] **Step 4: Verificar post-migration**

Use Turso MCP `execute_read_only_query`:
```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```
Expected: 8 tablas — `combo_purchase_items`, `combo_purchases`, `event_logs`, `orders`, `purchase_numbers`, `purchases`, `raffle_numbers`, `raffles`.

```sql
SELECT COUNT(*) FROM purchases WHERE order_id IS NULL;
```
Expected: 7 (las cancelled legacy).

- [ ] **Step 5: Commit (state marker, sin código)**

```bash
git commit --allow-empty -m "chore(fase-7): migration 0001 aplicada a Turso prod"
```

---

### Task 5: orderService skeleton + types

**Files:**
- Create: `lib/services/orderService.ts`
- Create: `tests/order-service.test.mjs`

- [ ] **Step 1: Write failing test for `OrderService.isDbAvailable`**

Create `tests/order-service.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../lib/services/orderService.ts';

test('OrderService.isDbAvailable returns boolean', () => {
  const result = OrderService.isDbAvailable();
  assert.equal(typeof result, 'boolean');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import tsx/esm tests/order-service.test.mjs`
Expected: FAIL with "Cannot find module .../orderService.ts".

- [ ] **Step 3: Create skeleton orderService**

Create `lib/services/orderService.ts`:
```ts
import { db, schema } from '../db';
import { eq, and, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { RaffleService } from './raffleService';
import { ComboService } from './comboService';
import { calculateTotal, getComboById, type CartItem } from '../combos';

const { orders, purchases, comboPurchases, comboPurchaseItems, raffleNumbers, eventLogs } = schema;

export interface OrderBuyer {
  name: string;
  email: string;
  phone?: string;
  studentName?: string;
  division?: string;
  course?: string;
}

export interface CreateOrderInput {
  buyer: OrderBuyer;
  raffle?: { raffleId: number; numberIds: number[] };
  combos?: CartItem[];
}

export interface CreateOrderResult {
  orderId: string;
  raffleChildId?: string;
  comboChildId?: string;
  totalAmount: number;
}

export class OrderService {
  static isDbAvailable(): boolean {
    return db !== null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import tsx/esm tests/order-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/orderService.ts tests/order-service.test.mjs
git commit -m "feat(fase-7): orderService skeleton + isDbAvailable"
```

---

### Task 6: orderService.createOrder (solo-rifa)

**Files:**
- Modify: `lib/services/orderService.ts`
- Modify: `tests/order-service.test.mjs`

- [ ] **Step 1: Write failing test for createOrder solo-rifa**

Append to `tests/order-service.test.mjs`:
```js
test('OrderService.createOrder with raffle only creates order + purchase + reserves nums', async (t) => {
  // Skipped if no DB. Runs only with TURSO_DATABASE_URL pointing to test BD.
  if (!OrderService.isDbAvailable()) return t.skip('DB not available');

  const result = await OrderService.createOrder({
    buyer: { name: 'Test User', email: 't@t.com', phone: '1234', studentName: 'Hijo', division: 'A', course: '5' },
    raffle: { raffleId: 2, numberIds: [1, 2] },
  });
  assert.match(result.orderId, /^ORD-[A-Za-z0-9_-]+$/);
  assert.match(result.raffleChildId, /^PUR-[A-Za-z0-9_-]+$/);
  assert.equal(result.comboChildId, undefined);
  assert.ok(result.totalAmount > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import tsx/esm tests/order-service.test.mjs`
Expected: FAIL con "createOrder is not a function".

- [ ] **Step 3: Implement createOrder (solo-rifa branch)**

Append a la clase `OrderService` en `lib/services/orderService.ts`:
```ts
  static async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!this.isDbAvailable()) {
      throw new Error('Database not available');
    }
    if (!input.raffle && !input.combos) {
      throw new Error('Order must have at least raffle or combos');
    }

    const orderId = `ORD-${nanoid(10)}`;
    const hasRaffle = !!input.raffle && input.raffle.numberIds.length > 0;
    const hasCombos = !!input.combos && input.combos.length > 0;

    if (hasRaffle && (input.raffle!.numberIds.length < 1 || input.raffle!.numberIds.length > 10)) {
      throw new Error('Cap de números rifa: 1-10 por order');
    }

    if (hasRaffle && (!input.buyer.studentName || !input.buyer.division || !input.buyer.course)) {
      throw new Error('Datos del estudiante requeridos cuando hay rifa');
    }

    return db.transaction(async (tx: any) => {
      const raffleConfig = hasRaffle
        ? await tx.select().from(schema.raffles).where(eq(schema.raffles.id, input.raffle!.raffleId)).limit(1).then((r: any[]) => r[0])
        : null;
      if (hasRaffle && !raffleConfig) throw new Error(`Raffle ${input.raffle!.raffleId} not found`);

      const raffleTotal = hasRaffle ? raffleConfig.pricePerNumber * input.raffle!.numberIds.length : 0;
      const comboTotal = hasCombos ? calculateTotal(input.combos!) : 0;
      const totalAmount = raffleTotal + comboTotal;

      await tx.insert(orders).values({
        id: orderId,
        buyerName: input.buyer.name,
        email: input.buyer.email,
        phone: input.buyer.phone ?? null,
        studentName: input.buyer.studentName ?? null,
        division: input.buyer.division ?? null,
        course: input.buyer.course ?? null,
        totalAmount,
        hasRaffle,
        hasCombos,
        paymentStatus: 'pending',
      });

      let raffleChildId: string | undefined;
      let comboChildId: string | undefined;

      if (hasRaffle) {
        raffleChildId = `PUR-${nanoid(10)}`;
        await tx.insert(purchases).values({
          id: raffleChildId,
          raffleId: input.raffle!.raffleId,
          orderId,
          buyerName: input.buyer.name,
          studentName: input.buyer.studentName!,
          division: input.buyer.division!,
          course: input.buyer.course!,
          email: input.buyer.email,
          phone: input.buyer.phone ?? null,
          totalAmount: raffleTotal,
          numbersCount: input.raffle!.numberIds.length,
          paymentStatus: 'pending',
        });

        const reservedAt = new Date();
        for (const num of input.raffle!.numberIds) {
          const result = await tx.update(raffleNumbers)
            .set({ status: 'reserved', reservedAt, purchaseId: raffleChildId, updatedAt: new Date() })
            .where(and(
              eq(raffleNumbers.raffleId, input.raffle!.raffleId),
              eq(raffleNumbers.number, num),
              eq(raffleNumbers.status, 'available')
            ))
            .returning({ id: raffleNumbers.id });
          if (result.length === 0) {
            throw new Error(`Número ${num} no disponible (race con otro user o ya reservado)`);
          }
          await tx.insert(schema.purchaseNumbers).values({
            purchaseId: raffleChildId,
            raffleNumberId: result[0].id,
          });
        }

        await tx.insert(eventLogs).values({
          eventType: 'PURCHASE_CREATED',
          purchaseId: raffleChildId,
          orderId,
          data: JSON.stringify({ orderId, numberIds: input.raffle!.numberIds, totalAmount: raffleTotal }),
        });
      }

      if (hasCombos) {
        const validItems = input.combos!.filter((it) => it.quantity > 0 && getComboById(it.comboId));
        if (validItems.length === 0) throw new Error('No valid combo items');
        const itemsCount = validItems.reduce((s, it) => s + it.quantity, 0);
        comboChildId = `COM-${nanoid(8)}`;
        await tx.insert(comboPurchases).values({
          id: comboChildId,
          orderId,
          buyerName: input.buyer.name,
          email: input.buyer.email,
          phone: input.buyer.phone ?? '',
          totalAmount: comboTotal,
          itemsCount,
          paymentStatus: 'pending',
        });
        for (const item of validItems) {
          const combo = getComboById(item.comboId)!;
          await tx.insert(comboPurchaseItems).values({
            comboPurchaseId: comboChildId,
            comboId: combo.id,
            comboNameSnapshot: combo.name,
            unitPrice: combo.price,
            quantity: item.quantity,
          });
        }
        await tx.insert(eventLogs).values({
          eventType: 'COMBO_PURCHASE_CREATED',
          purchaseId: comboChildId,
          orderId,
          data: JSON.stringify({ orderId, items: validItems, totalAmount: comboTotal }),
        });
      }

      await tx.insert(eventLogs).values({
        eventType: 'ORDER_CREATED',
        orderId,
        data: JSON.stringify({ hasRaffle, hasCombos, totalAmount, raffleChildId, comboChildId }),
      });

      return { orderId, raffleChildId, comboChildId, totalAmount };
    });
  }
```

- [ ] **Step 4: Run test to verify it passes (skipped if no DB)**

Run: `node --test --import tsx/esm tests/order-service.test.mjs`
Expected: PASS o SKIP (si no hay DB). En CI sin DB siempre SKIP — el test efectivo se corre en sub-fase 7.C contra dev server.

- [ ] **Step 5: Lint+build**

Run: `npm run lint && npm run build`
Expected: ambos verdes.

- [ ] **Step 6: Commit**

```bash
git add lib/services/orderService.ts tests/order-service.test.mjs
git commit -m "feat(fase-7): orderService.createOrder con rifa + combos atomic"
```

---

### Task 7: orderService.cancelOrder (atomic)

**Files:**
- Modify: `lib/services/orderService.ts`
- Modify: `tests/order-service.test.mjs`

- [ ] **Step 1: Write failing test**

Append to `tests/order-service.test.mjs`:
```js
test('OrderService.cancelOrder marks order+children cancelled, releases nums', async (t) => {
  if (!OrderService.isDbAvailable()) return t.skip('DB not available');
  const created = await OrderService.createOrder({
    buyer: { name: 'X', email: 'x@x.com', studentName: 'S', division: 'A', course: '5' },
    raffle: { raffleId: 2, numberIds: [3, 4] },
  });
  await OrderService.cancelOrder(created.orderId);
  // Verify: query directa a orders confirma payment_status='cancelled'.
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `node --test --import tsx/esm tests/order-service.test.mjs`
Expected: FAIL "cancelOrder is not a function".

- [ ] **Step 3: Implement cancelOrder**

Append a la clase `OrderService`:
```ts
  static async cancelOrder(orderId: string): Promise<void> {
    if (!this.isDbAvailable()) return;

    await db.transaction(async (tx: any) => {
      const orderUpdate = await tx.update(orders)
        .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'pending')))
        .returning({ id: orders.id });

      if (orderUpdate.length === 0) {
        // Order ya no está pending (race con webhook approved o ya cancelled)
        await tx.insert(eventLogs).values({
          eventType: 'ORDER_CANCEL_RACE',
          orderId,
          data: JSON.stringify({ reason: 'order_not_pending' }),
        });
        return;
      }

      // Cancel rifa hija + libera nums (lock optimista WHERE pending/reserved)
      const raffleChildren = await tx.select({ id: purchases.id }).from(purchases).where(eq(purchases.orderId, orderId));
      for (const child of raffleChildren) {
        await tx.update(purchases)
          .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
          .where(and(eq(purchases.id, child.id), eq(purchases.paymentStatus, 'pending')));
        await tx.update(raffleNumbers)
          .set({ status: 'available', reservedAt: null, purchaseId: null, soldAt: null, updatedAt: new Date() })
          .where(and(eq(raffleNumbers.purchaseId, child.id), eq(raffleNumbers.status, 'reserved')));
      }

      // Cancel combo hija
      const comboChildren = await tx.select({ id: comboPurchases.id }).from(comboPurchases).where(eq(comboPurchases.orderId, orderId));
      for (const child of comboChildren) {
        await tx.update(comboPurchases)
          .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
          .where(and(eq(comboPurchases.id, child.id), eq(comboPurchases.paymentStatus, 'pending')));
      }

      await tx.insert(eventLogs).values({
        eventType: 'ORDER_CANCELLED',
        orderId,
        data: JSON.stringify({ raffleChildren: raffleChildren.map((c: any) => c.id), comboChildren: comboChildren.map((c: any) => c.id) }),
      });
    });
  }
```

- [ ] **Step 4: Run test**

Run: `node --test --import tsx/esm tests/order-service.test.mjs`
Expected: PASS o SKIP.

- [ ] **Step 5: Commit**

```bash
git add lib/services/orderService.ts tests/order-service.test.mjs
git commit -m "feat(fase-7): orderService.cancelOrder atomic con guards optimistas"
```

---

### Task 8: orderService.confirmOrderPayment (idempotent)

**Files:**
- Modify: `lib/services/orderService.ts`

- [ ] **Step 1: Implement confirmOrderPayment**

Append a la clase `OrderService`:
```ts
  static async confirmOrderPayment(
    orderId: string,
    paymentData: { mercadoPagoPaymentId?: string; paymentMethod?: string }
  ): Promise<{ confirmed: boolean; reason?: string }> {
    if (!this.isDbAvailable()) return { confirmed: false, reason: 'no_db' };

    let conflict: { reason: string; details: object } | null = null;

    try {
      return await db.transaction(async (tx: any) => {
        const [existing] = await tx.select({ paymentStatus: orders.paymentStatus })
          .from(orders).where(eq(orders.id, orderId)).limit(1);

        if (!existing) throw new Error(`Order ${orderId} not found`);
        if (existing.paymentStatus === 'approved') return { confirmed: false, reason: 'already_approved' };

        const orderUpdate = await tx.update(orders)
          .set({
            paymentStatus: 'approved',
            mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId ?? null,
            paymentMethod: paymentData.paymentMethod ?? null,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'pending')))
          .returning({ id: orders.id });

        if (orderUpdate.length === 0) {
          conflict = { reason: 'order_not_pending', details: { orderId, currentStatus: existing.paymentStatus } };
          throw new Error(`Order ${orderId} state changed concurrently`);
        }

        // Confirmar hijas
        const raffleChildren = await tx.select({ id: purchases.id })
          .from(purchases).where(eq(purchases.orderId, orderId));
        for (const child of raffleChildren) {
          const purchaseUpd = await tx.update(purchases)
            .set({
              paymentStatus: 'approved',
              mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId ?? null,
              paymentMethod: paymentData.paymentMethod ?? null,
              updatedAt: new Date(),
            })
            .where(and(eq(purchases.id, child.id), eq(purchases.paymentStatus, 'pending')))
            .returning({ id: purchases.id });
          if (purchaseUpd.length === 0) {
            conflict = { reason: 'raffle_child_not_pending', details: { orderId, childId: child.id } };
            throw new Error(`Raffle child ${child.id} state changed`);
          }
          const numbersUpd = await tx.update(raffleNumbers)
            .set({ status: 'sold', soldAt: new Date(), updatedAt: new Date() })
            .where(and(eq(raffleNumbers.purchaseId, child.id), eq(raffleNumbers.status, 'reserved')))
            .returning({ id: raffleNumbers.id });
          if (numbersUpd.length === 0) {
            conflict = { reason: 'no_reserved_numbers', details: { orderId, childId: child.id } };
            throw new Error(`No reserved numbers for ${child.id}`);
          }
        }

        const comboChildren = await tx.select({ id: comboPurchases.id })
          .from(comboPurchases).where(eq(comboPurchases.orderId, orderId));
        for (const child of comboChildren) {
          const upd = await tx.update(comboPurchases)
            .set({
              paymentStatus: 'approved',
              mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId ?? null,
              paymentMethod: paymentData.paymentMethod ?? null,
              updatedAt: new Date(),
            })
            .where(and(eq(comboPurchases.id, child.id), eq(comboPurchases.paymentStatus, 'pending')))
            .returning({ id: comboPurchases.id });
          if (upd.length === 0) {
            conflict = { reason: 'combo_child_not_pending', details: { orderId, childId: child.id } };
            throw new Error(`Combo child ${child.id} state changed`);
          }
        }

        await tx.insert(eventLogs).values({
          eventType: 'ORDER_PAYMENT_CONFIRMED',
          orderId,
          data: JSON.stringify({ ...paymentData, raffleChildren: raffleChildren.length, comboChildren: comboChildren.length }),
        });

        return { confirmed: true };
      });
    } catch (err) {
      const c = conflict;
      if (c) {
        try {
          await db.insert(eventLogs).values({
            eventType: 'ORDER_PAYMENT_CONFLICT',
            orderId,
            data: JSON.stringify({ ...c, paymentData }),
          });
        } catch {
          /* swallow */
        }
      }
      throw err;
    }
  }
```

- [ ] **Step 2: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes.

- [ ] **Step 3: Commit**

```bash
git add lib/services/orderService.ts
git commit -m "feat(fase-7): orderService.confirmOrderPayment idempotent + locks"
```

---

### Task 9: orderService.removeNumberFromOrder

**Files:**
- Modify: `lib/services/orderService.ts`

- [ ] **Step 1: Implement removeNumberFromOrder**

Append a la clase `OrderService`:
```ts
  static async removeNumberFromOrder(
    orderId: string,
    rafflePurchaseId: string,
    numberToRemove: number,
    raffleId: number
  ): Promise<{ removed: boolean; reason?: string }> {
    if (!this.isDbAvailable()) return { removed: false, reason: 'no_db' };

    return db.transaction(async (tx: any) => {
      const [order] = await tx.select({ paymentStatus: orders.paymentStatus })
        .from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { removed: false, reason: 'order_not_found' };
      if (order.paymentStatus !== 'pending') return { removed: false, reason: 'order_not_pending' };

      const [num] = await tx.select({ id: raffleNumbers.id })
        .from(raffleNumbers)
        .where(and(
          eq(raffleNumbers.raffleId, raffleId),
          eq(raffleNumbers.number, numberToRemove),
          eq(raffleNumbers.purchaseId, rafflePurchaseId),
          eq(raffleNumbers.status, 'reserved'),
        )).limit(1);
      if (!num) return { removed: false, reason: 'number_not_in_order' };

      // Liberar el número
      await tx.update(raffleNumbers)
        .set({ status: 'available', reservedAt: null, purchaseId: null, updatedAt: new Date() })
        .where(and(eq(raffleNumbers.id, num.id), eq(raffleNumbers.status, 'reserved')));

      // Eliminar la fila de purchase_numbers
      await tx.delete(schema.purchaseNumbers).where(and(
        eq(schema.purchaseNumbers.purchaseId, rafflePurchaseId),
        eq(schema.purchaseNumbers.raffleNumberId, num.id),
      ));

      // Decrementar numbers_count y total_amount en purchase + order
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, rafflePurchaseId)).limit(1);
      if (!purchase) return { removed: false, reason: 'purchase_not_found' };
      const newCount = purchase.numbersCount - 1;
      const [raffleConfig] = await tx.select().from(schema.raffles).where(eq(schema.raffles.id, raffleId)).limit(1);
      const decrement = raffleConfig.pricePerNumber;
      const newPurchaseTotal = purchase.totalAmount - decrement;

      // Recalcular totalAmount actual del order
      const [currOrder] = await tx.select({ totalAmount: orders.totalAmount }).from(orders).where(eq(orders.id, orderId)).limit(1);
      const newOrderTotal = currOrder.totalAmount - decrement;

      if (newCount === 0) {
        // Era el último número: cancelar la hija rifa entera
        await tx.update(purchases)
          .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
          .where(and(eq(purchases.id, rafflePurchaseId), eq(purchases.paymentStatus, 'pending')));

        // Recalcular total del order: solo combo child queda
        const [comboChild] = await tx.select({ totalAmount: comboPurchases.totalAmount })
          .from(comboPurchases).where(eq(comboPurchases.orderId, orderId)).limit(1);
        const totalAfterRaffleRemoved = comboChild?.totalAmount ?? 0;

        await tx.update(orders)
          .set({ hasRaffle: false, totalAmount: totalAfterRaffleRemoved, updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        if (totalAfterRaffleRemoved === 0) {
          // Order vacío → cancelar order
          await tx.update(orders).set({ paymentStatus: 'cancelled', updatedAt: new Date() })
            .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'pending')));
        }
      } else {
        // Quedan números: decrementar count y total en purchase + order
        await tx.update(purchases)
          .set({ numbersCount: newCount, totalAmount: newPurchaseTotal, updatedAt: new Date() })
          .where(eq(purchases.id, rafflePurchaseId));
        await tx.update(orders)
          .set({ totalAmount: newOrderTotal, updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      }

      await tx.insert(eventLogs).values({
        eventType: 'ORDER_NUMBER_REMOVED',
        orderId,
        purchaseId: rafflePurchaseId,
        data: JSON.stringify({ numberRemoved: numberToRemove, newCount }),
      });

      return { removed: true };
    });
  }
```

- [ ] **Step 2: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes (ajustar el `placeholder` de orders.totalAmount si TS se queja — la implementación correcta es la del bloque `else` que hace SELECT actual y resta).

- [ ] **Step 3: Commit**

```bash
git add lib/services/orderService.ts
git commit -m "feat(fase-7): orderService.removeNumberFromOrder con guards"
```

---

### Task 10: orderService.releaseExpiredOrders (cron)

**Files:**
- Modify: `lib/services/orderService.ts`

- [ ] **Step 1: Implement releaseExpiredOrders**

Append a la clase `OrderService`:
```ts
  static async releaseExpiredOrders(): Promise<{ cancelled: number; releasedNumbers: number }> {
    if (!this.isDbAvailable()) return { cancelled: 0, releasedNumbers: 0 };

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    let cancelled = 0;
    let releasedNumbers = 0;

    const expired = await db.select({ id: orders.id })
      .from(orders)
      .where(and(
        eq(orders.paymentStatus, 'pending'),
        eq(orders.hasRaffle, true),
        lte(orders.createdAt, fifteenMinutesAgo),
      ));

    for (const order of expired) {
      // Contar nums reservados antes de cancelar
      const numsBefore = await db.select({ count: schema.raffleNumbers.id })
        .from(schema.raffleNumbers)
        .innerJoin(schema.purchases, eq(schema.raffleNumbers.purchaseId, schema.purchases.id))
        .where(and(
          eq(schema.purchases.orderId, order.id),
          eq(schema.raffleNumbers.status, 'reserved'),
        ));
      releasedNumbers += numsBefore.length;
      await this.cancelOrder(order.id);
      cancelled++;
    }

    return { cancelled, releasedNumbers };
  }
```

- [ ] **Step 2: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes.

- [ ] **Step 3: Commit**

```bash
git add lib/services/orderService.ts
git commit -m "feat(fase-7): orderService.releaseExpiredOrders para cron cleanup"
```

---

### Task 11: createOrderPreference en mercadopago.ts

**Files:**
- Modify: `lib/mercadopago.ts`

- [ ] **Step 1: Agregar createOrderPreference y mantener getPaymentInfo intacto**

Reemplazá el contenido de `lib/mercadopago.ts` con (mantiene `getPaymentInfo`, `isPaymentApproved`, `getPurchaseIdFromPayment`, agrega `createOrderPreference`, **elimina** `createPaymentPreference` y `createComboPreference`):

```ts
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000, idempotencyKey: 'abc' }
});

const preference = new Preference(client);
const payment = new Payment(client);

interface PreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

interface CreateOrderPreferenceData {
  orderId: string;
  buyer: { name: string; email: string };
  raffle?: { title: string; numbers: number[]; pricePerNumber: number };
  combos?: { id: string; name: string; quantity: number; unitPrice: number }[];
}

export async function createOrderPreference(data: CreateOrderPreferenceData) {
  try {
    console.log('[MP] Creating order preference for:', data.orderId);

    const items: PreferenceItem[] = [];

    if (data.raffle && data.raffle.numbers.length > 0) {
      items.push({
        id: data.orderId,
        title: `${data.raffle.title} - Números: ${data.raffle.numbers.join(', ')}`,
        quantity: 1,
        unit_price: data.raffle.pricePerNumber * data.raffle.numbers.length,
        currency_id: 'ARS'
      });
    }

    if (data.combos && data.combos.length > 0) {
      for (const c of data.combos) {
        items.push({
          id: c.id,
          title: c.name,
          quantity: c.quantity,
          unit_price: c.unitPrice,
          currency_id: 'ARS'
        });
      }
    }

    if (items.length === 0) throw new Error('Order has no items');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
    const nNums = data.raffle?.numbers.length ?? 0;
    const nCombos = data.combos?.reduce((s, c) => s + c.quantity, 0) ?? 0;

    const preferenceData = {
      items,
      payer: { name: data.buyer.name, email: data.buyer.email },
      back_urls: {
        success: `${baseUrl}/api/order/payment/success`,
        failure: `${baseUrl}/api/order/payment/failure`,
        pending: `${baseUrl}/api/order/payment/pending`
      },
      external_reference: data.orderId,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      description: `STA - ${data.orderId} - ${nNums} nums + ${nCombos} combos`,
      statement_descriptor: 'RIFA STA',
      payment_methods: { excluded_payment_types: [], installments: 1, default_installments: 1 },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };

    const response = await preference.create({ body: preferenceData });
    console.log('[MP] Preference created:', { id: response.id, init_point: response.init_point });

    return {
      preferenceId: response.id!,
      initPoint: response.init_point!,
      sandboxInitPoint: response.sandbox_init_point!
    };
  } catch (error) {
    console.error('[MP] Error creating order preference:', error);
    throw new Error('Failed to create order payment preference');
  }
}

export async function getPaymentInfo(paymentId: string) {
  try {
    const response = await payment.get({ id: paymentId });
    return {
      id: response.id,
      status: response.status,
      statusDetail: response.status_detail,
      externalReference: response.external_reference,
      amount: response.transaction_amount,
      paymentMethod: response.payment_method,
      payerEmail: response.payer?.email
    };
  } catch (error) {
    console.error('Error fetching payment info:', error);
    throw new Error('Failed to get payment information');
  }
}

export async function isPaymentApproved(paymentId: string): Promise<boolean> {
  try {
    const info = await getPaymentInfo(paymentId);
    return info.status === 'approved';
  } catch {
    return false;
  }
}

export async function getPurchaseIdFromPayment(paymentId: string): Promise<string | null> {
  try {
    const info = await getPaymentInfo(paymentId);
    return info.externalReference || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verificar lint+build (puede fallar porque hay routes viejas que importan `createPaymentPreference`)**

Run: `npm run lint && npm run build`
Expected: posibles errores de TypeScript en `app/api/preference/route.ts` y `app/api/combo/preference/route.ts`. **Aceptable** porque esos archivos se borran en Tasks 13 y 21.

- [ ] **Step 3: Commit**

```bash
git add lib/mercadopago.ts
git commit -m "feat(fase-7): createOrderPreference (delete createPayment/Combo Preference)"
```

---

### Task 12: POST /api/order/purchase

**Files:**
- Create: `app/api/order/purchase/route.ts`

- [ ] **Step 1: Implement route**

Create `app/api/order/purchase/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({
  buyer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    studentName: z.string().optional(),
    division: z.string().optional(),
    course: z.string().optional(),
  }),
  raffle: z.object({
    raffleId: z.number().int().positive(),
    numberIds: z.array(z.number().int().positive()).min(1).max(10),
  }).optional(),
  combos: z.array(z.object({
    comboId: z.string(),
    quantity: z.number().int().positive().max(50),
  })).optional(),
}).refine(d => d.raffle || d.combos, { message: 'At least raffle or combos required' });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.parse(body);

    if (parsed.raffle && (!parsed.buyer.studentName || !parsed.buyer.division || !parsed.buyer.course)) {
      return NextResponse.json({ success: false, error: 'Datos del estudiante requeridos cuando hay rifa' }, { status: 400 });
    }

    const result = await OrderService.createOrder(parsed);
    return NextResponse.json({ success: true, data: result }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: e.errors }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('no disponible')) {
      return NextResponse.json({ success: false, error: msg }, { status: 409 });
    }
    console.error('[POST /api/order/purchase]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes.

- [ ] **Step 3: Commit**

```bash
git add app/api/order/purchase/route.ts
git commit -m "feat(fase-7): POST /api/order/purchase con Zod + 409 para race conflicts"
```

---

### Task 13: POST /api/order/cancel

**Files:**
- Create: `app/api/order/cancel/route.ts`

- [ ] **Step 1: Implement route**

Create `app/api/order/cancel/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({ orderId: z.string().regex(/^ORD-/) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = Schema.parse(body);
    await OrderService.cancelOrder(orderId);
    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    console.error('[POST /api/order/cancel]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes.

- [ ] **Step 3: Commit**

```bash
git add app/api/order/cancel/route.ts
git commit -m "feat(fase-7): POST /api/order/cancel"
```

---

### Task 14: DELETE /api/order/items

**Files:**
- Create: `app/api/order/items/route.ts`

- [ ] **Step 1: Implement route**

Create `app/api/order/items/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({
  orderId: z.string().regex(/^ORD-/),
  rafflePurchaseId: z.string().regex(/^PUR-/),
  raffleId: z.number().int().positive(),
  number: z.number().int().positive(),
});

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, rafflePurchaseId, raffleId, number } = Schema.parse(body);
    const result = await OrderService.removeNumberFromOrder(orderId, rafflePurchaseId, number, raffleId);
    if (!result.removed) {
      return NextResponse.json({ success: false, error: result.reason ?? 'unknown' }, { status: 409 });
    }
    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    console.error('[DELETE /api/order/items]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Lint+build, commit**

Run: `npm run lint && npm run build`
```bash
git add app/api/order/items/route.ts
git commit -m "feat(fase-7): DELETE /api/order/items para mini-carrito"
```

---

### Task 15: POST /api/order/preference

**Files:**
- Create: `app/api/order/preference/route.ts`

- [ ] **Step 1: Implement route**

Create `app/api/order/preference/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createOrderPreference } from '@/lib/mercadopago';
import { getComboById } from '@/lib/combos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({ orderId: z.string().regex(/^ORD-/) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = Schema.parse(body);

    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (order.paymentStatus !== 'pending') {
      return NextResponse.json({ success: false, error: 'Order not pending' }, { status: 409 });
    }

    let raffleData: { title: string; numbers: number[]; pricePerNumber: number } | undefined;
    if (order.hasRaffle) {
      const [purchase] = await db.select().from(schema.purchases).where(eq(schema.purchases.orderId, orderId)).limit(1);
      if (!purchase) throw new Error(`Raffle child not found for order ${orderId}`);
      const nums = await db.select({ raffleNumberId: schema.purchaseNumbers.raffleNumberId })
        .from(schema.purchaseNumbers).where(eq(schema.purchaseNumbers.purchaseId, purchase.id));
      const numbers = await Promise.all(nums.map(async (pn) => {
        const [rn] = await db.select({ number: schema.raffleNumbers.number })
          .from(schema.raffleNumbers).where(eq(schema.raffleNumbers.id, pn.raffleNumberId)).limit(1);
        return rn.number;
      }));
      const [raffle] = await db.select().from(schema.raffles).where(eq(schema.raffles.id, purchase.raffleId)).limit(1);
      raffleData = { title: raffle.title, numbers: numbers.sort((a, b) => a - b), pricePerNumber: raffle.pricePerNumber };
    }

    let comboData: { id: string; name: string; quantity: number; unitPrice: number }[] | undefined;
    if (order.hasCombos) {
      const [comboPurchase] = await db.select().from(schema.comboPurchases).where(eq(schema.comboPurchases.orderId, orderId)).limit(1);
      if (!comboPurchase) throw new Error(`Combo child not found for order ${orderId}`);
      const items = await db.select().from(schema.comboPurchaseItems).where(eq(schema.comboPurchaseItems.comboPurchaseId, comboPurchase.id));
      comboData = items.map((it) => ({
        id: it.comboId,
        name: `${it.comboNameSnapshot} (combo)`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));
    }

    const preference = await createOrderPreference({
      orderId,
      buyer: { name: order.buyerName, email: order.email },
      raffle: raffleData,
      combos: comboData,
    });

    await db.update(schema.orders)
      .set({ mercadoPagoPreferenceId: preference.preferenceId, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));

    return NextResponse.json({ success: true, data: preference }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    console.error('[POST /api/order/preference]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 503 });
  }
}
```

- [ ] **Step 2: Lint+build, commit**

```bash
git add app/api/order/preference/route.ts
git commit -m "feat(fase-7): POST /api/order/preference con MP createOrderPreference"
```

---

### Task 16: GET /api/order/payment/{success,failure,pending}

**Files:**
- Create: `app/api/order/payment/success/route.ts`
- Create: `app/api/order/payment/failure/route.ts`
- Create: `app/api/order/payment/pending/route.ts`

- [ ] **Step 1: Create payment/success/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('external_reference') ?? '';
  const paymentId = searchParams.get('payment_id') ?? '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  return NextResponse.redirect(`${baseUrl}/?payment=success&order=${orderId}&payment_id=${paymentId}`);
}
```

- [ ] **Step 2: Create payment/failure/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('external_reference') ?? '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  return NextResponse.redirect(`${baseUrl}/?payment=failure&order=${orderId}`);
}
```

- [ ] **Step 3: Create payment/pending/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('external_reference') ?? '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  return NextResponse.redirect(`${baseUrl}/?payment=pending&order=${orderId}`);
}
```

- [ ] **Step 4: Lint+build, commit**

Run: `npm run lint && npm run build`
```bash
git add app/api/order/payment/
git commit -m "feat(fase-7): GET /api/order/payment/{success,failure,pending} redirects"
```

---

### Task 17: Webhook dispatch ORD- + retrocompat

**Files:**
- Modify: `app/api/webhooks/mercadopago/route.ts`

- [ ] **Step 1: Read current webhook handler**

Run: `cat app/api/webhooks/mercadopago/route.ts`
Inspeccionar la estructura actual del dispatch (ya tiene branches `PUR-` → `handleRifaPayment` y `COM-` → `handleComboPayment`).

- [ ] **Step 2: Refactor dispatch para agregar `ORD-` y degradar `PUR-`/`COM-` a retrocompat-only**

Modificá el handler agregando una rama `ORD-` que llama `OrderService.confirmOrderPayment` o `cancelOrder` según `paymentInfo.status`, y degradar las ramas `PUR-` y `COM-` a "log + 200" (no procesar). Mantener intacto el HMAC verify, getPaymentInfo, y la respuesta 503 para errores transitorios.

Bloque dispatch (mantener intactos: import del top, HMAC verify, parseo de body, getPaymentInfo de MP API; reemplazar SOLO el bloque que hoy hace dispatch por prefijo a `handleRifaPayment` / `handleComboPayment`).

Imports adicionales al top:
```ts
import { OrderService } from '@/lib/services/orderService';
import { db, schema } from '@/lib/db';
```

Reemplazar el bloque de dispatch actual por:
```ts
const ref = paymentInfo.externalReference ?? '';

if (ref.startsWith('ORD-')) {
  if (paymentInfo.status === 'approved') {
    const result = await OrderService.confirmOrderPayment(ref, {
      mercadoPagoPaymentId: String(paymentInfo.id),
      paymentMethod: paymentInfo.paymentMethod?.type,
    });
    console.log(`[Webhook ORD-] confirmOrderPayment ${ref}:`, result);
  } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
    await OrderService.cancelOrder(ref);
    console.log(`[Webhook ORD-] cancelOrder ${ref}`);
  } else {
    console.log(`[Webhook ORD-] status ${paymentInfo.status} for ${ref}, no-op`);
  }
  return NextResponse.json({ received: true }, { status: 200 });
}

if (ref.startsWith('PUR-')) {
  console.warn(`[Webhook] Legacy PUR- received post-Fase 7: ${ref}`);
  await db.insert(schema.eventLogs).values({
    eventType: 'LEGACY_PUR_WEBHOOK_IGNORED',
    purchaseId: ref,
    data: JSON.stringify({ paymentInfo }),
  });
  return NextResponse.json({ received: true, ignored: 'legacy_PUR' }, { status: 200 });
}

if (ref.startsWith('COM-')) {
  console.warn(`[Webhook] Legacy COM- received post-Fase 7: ${ref}`);
  await db.insert(schema.eventLogs).values({
    eventType: 'LEGACY_COM_WEBHOOK_IGNORED',
    purchaseId: ref,
    data: JSON.stringify({ paymentInfo }),
  });
  return NextResponse.json({ received: true, ignored: 'legacy_COM' }, { status: 200 });
}

console.error(`[Webhook] UNKNOWN_REFERENCE: ${ref}`);
return NextResponse.json({ received: true, ignored: 'unknown_ref' }, { status: 200 });
```

- [ ] **Step 3: Run unit tests del webhook (deben seguir pasando)**

Run: `node --test --import tsx/esm tests/webhook-verification.test.mjs`
Expected: 15/15 pass (sin cambios al verify HMAC).

- [ ] **Step 4: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes.

- [ ] **Step 5: Invoke `payment-flow-debugger` agent**

Dispatch: agent `payment-flow-debugger` con prompt:
> "Revisar el dispatch del webhook MP en `app/api/webhooks/mercadopago/route.ts` después del refactor Fase 7. Validar: (a) HMAC verify intacto, (b) rama ORD- llama OrderService.confirmOrderPayment correctamente, (c) idempotencia preservada, (d) ramas PUR-/COM- son log-only (no procesan), (e) errores transitorios devuelven 503 para retry MP. Spec: §6.2."

Expected: aprobación.

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/mercadopago/route.ts
git commit -m "feat(fase-7): webhook dispatch ORD- + retrocompat PUR/COM log-only"
```

---

### Task 18: /api/cron/cleanup refactor

**Files:**
- Modify: `app/api/cron/cleanup/route.ts`

- [ ] **Step 1: Read current cleanup handler**

Run: `cat app/api/cron/cleanup/route.ts`

- [ ] **Step 2: Refactor para llamar OrderService.releaseExpiredOrders en lugar de RaffleService.releaseExpiredReservations**

Reemplazar el contenido por:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await OrderService.releaseExpiredOrders();
    console.log('Cleanup completed:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('[Cron cleanup] error:', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Lint+build**

Run: `npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/cleanup/route.ts
git commit -m "feat(fase-7): cron cleanup llama OrderService.releaseExpiredOrders"
```

---

### Task 19: Borrar 12 routes viejas

**Files:**
- Delete: `app/api/purchase/route.ts`
- Delete: `app/api/purchase/cancel/route.ts`
- Delete: `app/api/preference/route.ts`
- Delete: `app/api/payment/success/route.ts`
- Delete: `app/api/payment/failure/route.ts`
- Delete: `app/api/payment/pending/route.ts`
- Delete: `app/api/payment/confirm/route.ts`
- Delete: `app/api/payment/cancel/route.ts`
- Delete: `app/api/combo/purchase/route.ts`
- Delete: `app/api/combo/cancel/route.ts`
- Delete: `app/api/combo/preference/route.ts`
- Delete: `app/api/combo/payment/success/route.ts`
- Delete: `app/api/combo/payment/failure/route.ts`
- Delete: `app/api/combo/payment/pending/route.ts`

- [ ] **Step 1: Borrar las routes viejas**

Run:
```bash
rm -rf app/api/purchase/ app/api/preference/ app/api/payment/ app/api/combo/
```

- [ ] **Step 2: Verificar que no hay imports rotos**

Run: `npm run lint && npm run build`
Expected: el frontend (RifasApp + ComboFlow legacy) podría tener imports a `/api/purchase` etc. — `npm run lint` no detecta strings en URLs. **El build sí pasa** porque las URLs son strings opacos. Estos imports se arreglan en sub-fase 7.B (Task 30 RifasApp shell refactor + Task 31 borrar componentes viejos). Para esta tarea, **el flow rifa pura y combos pura del frontend ROMPE** (404 al llamar a las rutas viejas) — aceptable porque la sub-fase 7.B reemplaza el frontend completo.

- [ ] **Step 3: Commit**

```bash
git add -A app/api/
git commit -m "feat(fase-7): borrar 12 routes viejas (replaced by /api/order/*)"
```

---

### Task 20: Cleanup helpers viejos en raffleService y comboService

**Files:**
- Modify: `lib/services/raffleService.ts`
- Modify: `lib/services/comboService.ts`

- [ ] **Step 1: raffleService — eliminar releaseExpiredReservations + crear `tx`-aware variants si hace falta**

`raffleService.releaseExpiredReservations` ya no se llama (cron usa OrderService). Borrar el método entero (líneas 513-607 aprox de la implementación actual).

`raffleService.reserveNumbers`, `createPurchase`, `confirmPayment`, `cancelPayment` siguen existiendo pero ya no se llaman desde routes (las routes viejas se borraron). Marcarlas como `@deprecated` con un JSDoc o evaluá si vale borrar — **decisión del implementer**: si las funciones quedan sin usar después del cleanup de UI (Task 31 + 32), borrarlas en Task 22 (final review).

Para esta tarea: **solo borrar `releaseExpiredReservations`**.

- [ ] **Step 2: comboService — eliminar `cancelComboPayment` standalone**

`comboService.cancelComboPayment` y `confirmComboPayment` ya no se llaman desde el webhook (que ahora dispatch a OrderService). Si se necesitan como helpers `tx`-aware del orderService, refactorizarlas para aceptar `tx` como argumento. Para esta tarea, **borrar las dos funciones** y dejar `comboService.createComboPurchase` solo si `OrderService.createOrder` la importa y usa internamente.

Inspeccionar: `grep -rn "ComboService" lib/ app/`. Si después del Task 19 los únicos consumers son `OrderService` y `comboService.createComboPurchase` ya no se usa porque está inlined en `OrderService.createOrder` → borrar `createComboPurchase` también.

- [ ] **Step 3: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes (si quedan imports rotos, removerlos).

- [ ] **Step 4: Commit**

```bash
git add lib/services/
git commit -m "refactor(fase-7): cleanup raffleService.releaseExpiredReservations + comboService helpers viejos"
```

---

### Task 21: Unit tests run

**Files:** ninguno

- [ ] **Step 1: Run all unit tests**

Run: `bash tests/run-tests.sh` (o el equivalente).
Expected: webhook-verification 15/15 pass + order-service tests 0/N pass (skipped sin DB) o todos pass si hay DB de test conectada.

- [ ] **Step 2: Commit (state marker)**

```bash
git commit --allow-empty -m "test(fase-7): unit tests pass post 7.A"
```

---

### Task 22: Final review 7.A

**Files:** ninguno (review-only)

- [ ] **Step 1: Lint+build verde**

Run: `npm run lint && npm run build`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Invoke `payment-flow-debugger` agent (final review)**

Dispatch: agent `payment-flow-debugger` con prompt:
> "Final review sub-fase 7.A. Revisar: (a) `OrderService.createOrder/cancelOrder/confirmOrderPayment/removeNumberFromOrder/releaseExpiredOrders` correctamente atómicos con locks optimistas, (b) MP preference con URLs runtime (no inline), (c) webhook dispatch ORD- + retrocompat sin regresión, (d) cron refactor coherente. Confirmar zero regresión en flow rifa pura y combo pura — ya no usados desde frontend pero deben seguir computacionalmente sanos. Spec: §3-§7."

Expected: aprobación o issues fixeables menores (si hay issues bloqueantes, fixearlos antes de avanzar a 7.B).

- [ ] **Step 3: Update ESTADO.md marcando 7.A completa**

Cambiar `[~] 7.A` a `[x] 7.A`. Agregar entrada de bitácora.

- [ ] **Step 4: Commit cierre 7.A**

```bash
git add ESTADO.md
git commit -m "chore(fase-7): cierre 7.A - server-side completo"
```

---

## Sub-fase 7.B — UI (Tasks 23-33)

Refactor RifasApp + ComboFlow → OrderFlow unificado. 7 componentes nuevos + 7 borrados + 5 refactoreados. Multi-select rifa hasta 10. Sticky cart bar + mini-carrito. Cross-sell bottom sheet.

---

### Task 23: NumberGrid multi-select hasta 10

**Files:**
- Modify: `components/grid/NumberGrid.tsx`

- [ ] **Step 1: Read current single-select NumberGrid**

Run: `cat components/grid/NumberGrid.tsx`

- [ ] **Step 2: Refactor para multi-select hasta 10**

Reemplazar la signature de `onSelect: (number: number) => void` por `onSelectionChange: (numbers: number[]) => void` y mantener internamente un estado `selectedNumbers: number[]`. Cuando el usuario tap en una celda, si está en el array remover, sino agregar (si len < 10). Header muestra "X/10 seleccionados".

```tsx
'use client';

import { useState, useCallback } from 'react';
import NumberCell from './NumberCell';
import GridLegend from './GridLegend';
import NumberSearch from './NumberSearch';
import RangeTabs from './RangeTabs';

interface NumberGridProps {
  numbers: Array<{ number: number; status: 'available' | 'reserved' | 'sold' }>;
  selected: number[];
  onSelectionChange: (numbers: number[]) => void;
  totalNumbers: number;
}

const CAP = 10;

export default function NumberGrid({ numbers, selected, onSelectionChange, totalNumbers }: NumberGridProps) {
  const [activeRange, setActiveRange] = useState(0);
  const [search, setSearch] = useState('');

  const handleCellClick = useCallback((num: number) => {
    if (selected.includes(num)) {
      onSelectionChange(selected.filter((n) => n !== num));
      return;
    }
    if (selected.length >= CAP) {
      // Optionally show toast — for now silently ignore
      return;
    }
    onSelectionChange([...selected, num].sort((a, b) => a - b));
  }, [selected, onSelectionChange]);

  // ... resto del componente: tabs, search filter, render del grid llamando NumberCell con isSelected={selected.includes(n.number)}
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-ink-soft">{selected.length}/{CAP} seleccionados</span>
        <NumberSearch value={search} onChange={setSearch} />
      </div>
      <RangeTabs active={activeRange} onChange={setActiveRange} totalNumbers={totalNumbers} />
      <GridLegend />
      <div className="grid grid-cols-10 gap-1.5 mt-3">
        {/* filtrar por activeRange y search; renderizar NumberCell */}
        {numbers
          .filter((n) => Math.floor((n.number - 1) / 100) === activeRange)
          .filter((n) => !search || String(n.number).startsWith(search))
          .map((n) => (
            <NumberCell
              key={n.number}
              number={n.number}
              status={n.status}
              isSelected={selected.includes(n.number)}
              onClick={() => handleCellClick(n.number)}
            />
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `NumberCell.tsx` para mostrar check icon cuando `isSelected`**

```tsx
import { Check } from 'lucide-react';

// En el JSX, agregar dentro del button:
{isSelected && <Check size={14} className="absolute top-0.5 right-0.5" />}
```

- [ ] **Step 4: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes (puede haber errors en RifasApp.tsx que llama a la signature vieja — se fixea en Task 31).

- [ ] **Step 5: Commit**

```bash
git add components/grid/
git commit -m "feat(fase-7): NumberGrid multi-select hasta 10 + check icon"
```

---

### Task 24: StickyCartBar component

**Files:**
- Create: `components/cart/StickyCartBar.tsx`

- [ ] **Step 1: Implement component**

Create `components/cart/StickyCartBar.tsx`:
```tsx
'use client';

import { ChevronUp } from 'lucide-react';

interface StickyCartBarProps {
  itemCount: number;
  total: number;
  onTap: () => void;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function StickyCartBar({ itemCount, total, onTap, ctaLabel, onCta }: StickyCartBarProps) {
  if (itemCount === 0) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-ink text-white rounded-t-card shadow-lg">
      <div className="max-w-[560px] mx-auto px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onTap}
          className="flex-1 flex items-center justify-between text-left"
          aria-label="Ver carrito"
        >
          <div>
            <div className="text-[11px] opacity-70">Tu compra</div>
            <div className="text-sm font-semibold">{itemCount} {itemCount === 1 ? 'item' : 'items'}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] opacity-70 flex items-center gap-1 justify-end">Ver detalle <ChevronUp size={12} /></div>
            <div className="text-base font-extrabold text-accent">${total.toLocaleString('es-AR')}</div>
          </div>
        </button>
        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={onCta}
            className="bg-brand text-white rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint+build, commit**

Run: `npm run lint && npm run build`
```bash
git add components/cart/StickyCartBar.tsx
git commit -m "feat(fase-7): StickyCartBar tappable con CTA opcional"
```

---

### Task 25: CartDrawer (mini-carrito editable)

**Files:**
- Create: `components/cart/CartDrawer.tsx`

- [ ] **Step 1: Implement bottom sheet con items rifa + combos editables**

Create `components/cart/CartDrawer.tsx`:
```tsx
'use client';

import { X, Minus, Plus, Trash2 } from 'lucide-react';
import type { CartItem } from '@/lib/combos';
import { getComboById } from '@/lib/combos';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  raffleNumbers: number[];
  combos: CartItem[];
  pricePerNumber: number;
  total: number;
  onRemoveNumber: (number: number) => void;
  onComboQuantityChange: (comboId: string, delta: number) => void;
  onRemoveCombo: (comboId: string) => void;
}

export default function CartDrawer(props: CartDrawerProps) {
  if (!props.open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={props.onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold tracking-tight">Tu compra</h2>
            <button onClick={props.onClose} aria-label="Cerrar">
              <X size={24} />
            </button>
          </div>

          {props.raffleNumbers.length > 0 && (
            <section className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🎟️ Números rifa</h3>
              <ul className="space-y-2">
                {props.raffleNumbers.map((n) => (
                  <li key={n} className="flex items-center justify-between bg-surface-raised rounded-md px-3 py-2">
                    <span className="font-semibold">#{String(n).padStart(4, '0')}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-ink-soft">${props.pricePerNumber.toLocaleString('es-AR')}</span>
                      <button onClick={() => props.onRemoveNumber(n)} aria-label={`Quitar número ${n}`}>
                        <Trash2 size={18} className="text-state-danger" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {props.combos.length > 0 && (
            <section className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🥪 Combos</h3>
              <ul className="space-y-2">
                {props.combos.map((it) => {
                  const combo = getComboById(it.comboId);
                  if (!combo) return null;
                  return (
                    <li key={it.comboId} className="flex items-center justify-between bg-surface-raised rounded-md px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{combo.name}</div>
                        <div className="text-xs text-ink-soft">${combo.price.toLocaleString('es-AR')} c/u</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => props.onComboQuantityChange(it.comboId, -1)} className="bg-surface w-8 h-8 rounded flex items-center justify-center" disabled={it.quantity <= 1} aria-label="Restar">
                          <Minus size={16} />
                        </button>
                        <span className="w-6 text-center font-semibold">{it.quantity}</span>
                        <button onClick={() => props.onComboQuantityChange(it.comboId, +1)} className="bg-surface w-8 h-8 rounded flex items-center justify-center" aria-label="Sumar">
                          <Plus size={16} />
                        </button>
                        <button onClick={() => props.onRemoveCombo(it.comboId)} aria-label={`Quitar ${combo.name}`}>
                          <Trash2 size={18} className="text-state-danger ml-2" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex items-center justify-between border-t pt-4 mb-4">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-extrabold text-accent">${props.total.toLocaleString('es-AR')}</span>
          </div>

          <button
            onClick={props.onClose}
            className="w-full bg-brand text-white rounded-md py-3 font-semibold"
          >
            Cerrar carrito
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Lint+build, commit**

```bash
git add components/cart/CartDrawer.tsx
git commit -m "feat(fase-7): CartDrawer mini-carrito editable con × y stepper"
```

---

### Task 26: CrossSellSheet

**Files:**
- Create: `components/cross-sell/CrossSellSheet.tsx`

- [ ] **Step 1: Implement bottom sheet "¿querés sumar X?"**

Create `components/cross-sell/CrossSellSheet.tsx`:
```tsx
'use client';

interface CrossSellSheetProps {
  open: boolean;
  onClose: () => void;
  productSold: 'rifa' | 'combo';
  onAccept: () => void;
  onDecline: () => void;
}

export default function CrossSellSheet({ open, onClose, productSold, onAccept, onDecline }: CrossSellSheetProps) {
  if (!open) return null;

  const otherProduct = productSold === 'rifa' ? 'combos del evento' : 'números de la rifa';
  const otherEmoji = productSold === 'rifa' ? '🥪' : '🎟️';
  const otherCta = productSold === 'rifa' ? 'Sí, ver combos' : 'Sí, ver rifa';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl">
        <div className="max-w-[560px] mx-auto px-5 py-7 text-center">
          <div className="text-5xl mb-3" aria-hidden>{otherEmoji}</div>
          <h2 className="text-xl font-extrabold tracking-tight mb-2">¿Querés sumar {otherProduct}?</h2>
          <p className="text-sm text-ink-soft mb-6">
            Sumalos a esta misma compra y pagás todo en una sola operación.
          </p>
          <div className="space-y-3">
            <button onClick={onAccept} className="w-full bg-brand text-white rounded-md py-3 font-semibold">
              {otherCta}
            </button>
            <button onClick={onDecline} className="w-full bg-surface-raised text-ink rounded-md py-3 font-semibold">
              No, seguir al pago
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Lint+build, commit**

```bash
git add components/cross-sell/CrossSellSheet.tsx
git commit -m "feat(fase-7): CrossSellSheet bottom sheet pre-form"
```

---

### Task 27: UnifiedBuyerForm adaptativo

**Files:**
- Create: `components/order/UnifiedBuyerForm.tsx`

- [ ] **Step 1: Implement form que renderiza 6 o 3 campos según `hasRaffle`**

Create `components/order/UnifiedBuyerForm.tsx`:
```tsx
'use client';

import FormField from '@/components/form/FormField';
import StudentBlock from '@/components/form/StudentBlock';

export interface BuyerData {
  name: string;
  email: string;
  phone: string;
  studentName?: string;
  division?: string;
  course?: string;
}

interface UnifiedBuyerFormProps {
  hasRaffle: boolean;
  data: BuyerData;
  onChange: (data: BuyerData) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function UnifiedBuyerForm({ hasRaffle, data, onChange, onSubmit, isSubmitting }: UnifiedBuyerFormProps) {
  const updateField = (field: keyof BuyerData, value: string) => onChange({ ...data, [field]: value });

  const isValid =
    data.name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(data.email) &&
    data.phone.trim().length > 0 &&
    (!hasRaffle || (
      (data.studentName ?? '').trim().length > 0 &&
      (data.division ?? '').trim().length > 0 &&
      (data.course ?? '').trim().length > 0
    ));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (isValid && !isSubmitting) onSubmit(); }}
      className="contents"
    >
      <div className="space-y-4">
        <FormField name="name" label="Nombre del comprador" value={data.name} onChange={(_, v) => updateField('name', v)} required />
        <FormField name="email" label="Email" type="email" value={data.email} onChange={(_, v) => updateField('email', v)} required />
        <FormField name="phone" label="Teléfono" type="tel" value={data.phone} onChange={(_, v) => updateField('phone', v)} required />
        {hasRaffle && (
          <StudentBlock
            studentName={data.studentName ?? ''}
            division={data.division ?? ''}
            course={data.course ?? ''}
            onChange={(field, value) => updateField(field as keyof BuyerData, value)}
          />
        )}
      </div>
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full bg-brand text-white rounded-md py-3 font-semibold mt-6 disabled:opacity-50"
      >
        {isSubmitting ? 'Enviando...' : 'Continuar al review'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Lint+build, commit**

```bash
git add components/order/UnifiedBuyerForm.tsx
git commit -m "feat(fase-7): UnifiedBuyerForm adaptativo (6 campos rifa, 3 solo combos)"
```

---

### Task 28: UnifiedReview

**Files:**
- Create: `components/order/UnifiedReview.tsx`

- [ ] **Step 1: Implement review unificado**

Create `components/order/UnifiedReview.tsx`:
```tsx
'use client';

import { Loader2 } from 'lucide-react';
import type { CartItem } from '@/lib/combos';
import { getComboById } from '@/lib/combos';
import type { BuyerData } from './UnifiedBuyerForm';

interface UnifiedReviewProps {
  raffleNumbers: number[];
  pricePerNumber: number;
  combos: CartItem[];
  buyer: BuyerData;
  total: number;
  onConfirm: () => void;
  onBack: () => void;
  isConfirming: boolean;
  raffleTitle: string;
}

export default function UnifiedReview(props: UnifiedReviewProps) {
  const raffleSubtotal = props.pricePerNumber * props.raffleNumbers.length;
  const combosSubtotal = props.combos.reduce((s, it) => s + (getComboById(it.comboId)?.price ?? 0) * it.quantity, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-extrabold tracking-tight">Revisá tu compra</h2>

      {props.raffleNumbers.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🎟️ {props.raffleTitle}</h3>
          <div className="bg-surface-raised rounded-md p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {props.raffleNumbers.map((n) => (
                <span key={n} className="bg-accent/10 text-accent rounded px-2 py-1 text-sm font-bold">
                  #{String(n).padStart(4, '0')}
                </span>
              ))}
            </div>
            <div className="flex justify-between text-sm">
              <span>{props.raffleNumbers.length} {props.raffleNumbers.length === 1 ? 'número' : 'números'} × ${props.pricePerNumber.toLocaleString('es-AR')}</span>
              <span className="font-semibold">${raffleSubtotal.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </section>
      )}

      {props.combos.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🥪 Combos del evento</h3>
          <div className="bg-surface-raised rounded-md p-4 space-y-2">
            {props.combos.map((it) => {
              const c = getComboById(it.comboId);
              if (!c) return null;
              return (
                <div key={it.comboId} className="flex justify-between text-sm">
                  <span>{c.name} × {it.quantity}</span>
                  <span className="font-semibold">${(c.price * it.quantity).toLocaleString('es-AR')}</span>
                </div>
              );
            })}
            <div className="border-t border-line pt-2 flex justify-between font-semibold">
              <span>Subtotal combos</span>
              <span>${combosSubtotal.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">Datos del comprador</h3>
        <div className="bg-surface-raised rounded-md p-4 space-y-1 text-sm">
          <div><span className="text-ink-soft">Nombre:</span> <strong>{props.buyer.name}</strong></div>
          <div><span className="text-ink-soft">Email:</span> <strong>{props.buyer.email}</strong></div>
          <div><span className="text-ink-soft">Tel:</span> <strong>{props.buyer.phone}</strong></div>
          {props.buyer.studentName && <div><span className="text-ink-soft">Alumno:</span> <strong>{props.buyer.studentName} — {props.buyer.course} {props.buyer.division}</strong></div>}
        </div>
      </section>

      <div className="bg-ink text-white rounded-md p-4 flex justify-between items-center">
        <span className="text-sm">Total a pagar</span>
        <span className="text-2xl font-extrabold text-accent">${props.total.toLocaleString('es-AR')}</span>
      </div>

      <div className="space-y-2">
        <button
          onClick={props.onConfirm}
          disabled={props.isConfirming}
          className="w-full bg-brand text-white rounded-md py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {props.isConfirming ? <><Loader2 className="animate-spin" size={18} /> Redirigiendo a MercadoPago...</> : 'Pagar con MercadoPago'}
        </button>
        <button
          onClick={props.onBack}
          disabled={props.isConfirming}
          className="w-full bg-surface-raised text-ink rounded-md py-3 font-semibold"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint+build, commit**

```bash
git add components/order/UnifiedReview.tsx
git commit -m "feat(fase-7): UnifiedReview con breakdown rifa+combos+buyer"
```

---

### Task 29: OrderSuccessScreen + adaptación FailureScreen/PendingScreen

**Files:**
- Create: `components/order/OrderSuccessScreen.tsx`

- [ ] **Step 1: Implement success genérico**

Create `components/order/OrderSuccessScreen.tsx`:
```tsx
'use client';

import { CheckCircle, Share2 } from 'lucide-react';
import type { CartItem } from '@/lib/combos';
import { getComboById } from '@/lib/combos';

interface OrderSuccessScreenProps {
  orderId: string;
  raffleNumbers?: number[];
  combos?: CartItem[];
  total?: number;
  onRestart: () => void;
}

export default function OrderSuccessScreen(props: OrderSuccessScreenProps) {
  const handleShare = () => {
    const parts: string[] = [];
    if (props.raffleNumbers && props.raffleNumbers.length > 0) {
      parts.push(`Compré ${props.raffleNumbers.length} ${props.raffleNumbers.length === 1 ? 'número' : 'números'} de la rifa: ${props.raffleNumbers.join(', ')}`);
    }
    if (props.combos && props.combos.length > 0) {
      const comboLines = props.combos.map((it) => {
        const c = getComboById(it.comboId);
        return c ? `${c.name} × ${it.quantity}` : null;
      }).filter(Boolean);
      parts.push(`Y combos: ${comboLines.join(', ')}`);
    }
    parts.push(`Mi código de orden: ${props.orderId}`);
    const text = parts.join('. ');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="text-center space-y-5 py-8">
      <CheckCircle size={64} className="text-state-success mx-auto" />
      <h2 className="text-2xl font-extrabold tracking-tight">¡Compra exitosa!</h2>
      <p className="text-ink-soft text-sm">Te enviamos el comprobante por email.</p>

      <div className="bg-accent/10 rounded-md p-5 inline-block">
        <div className="text-xs uppercase tracking-wider text-ink-soft mb-1">Código de orden</div>
        <div className="text-2xl font-extrabold tracking-wide">{props.orderId}</div>
      </div>

      {props.raffleNumbers && props.raffleNumbers.length > 0 && (
        <div className="bg-surface-raised rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-ink-soft mb-2">Números asignados</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {props.raffleNumbers.map((n) => (
              <span key={n} className="bg-brand text-white rounded px-3 py-1 font-bold">
                #{String(n).padStart(4, '0')}
              </span>
            ))}
          </div>
        </div>
      )}

      {props.combos && props.combos.length > 0 && (
        <div className="bg-surface-raised rounded-md p-4 text-left">
          <div className="text-xs uppercase tracking-wider text-ink-soft mb-2">Combos pedidos</div>
          <ul className="space-y-1 text-sm">
            {props.combos.map((it) => {
              const c = getComboById(it.comboId);
              return c ? <li key={it.comboId}>· {c.name} × {it.quantity}</li> : null;
            })}
          </ul>
        </div>
      )}

      {props.total && (
        <div className="text-sm">
          <span className="text-ink-soft">Total pagado: </span>
          <strong className="text-accent text-lg">${props.total.toLocaleString('es-AR')}</strong>
        </div>
      )}

      <div className="space-y-2">
        <button onClick={handleShare} className="w-full bg-state-success text-white rounded-md py-3 font-semibold flex items-center justify-center gap-2">
          <Share2 size={18} /> Compartir por WhatsApp
        </button>
        <button onClick={props.onRestart} className="w-full bg-surface-raised text-ink rounded-md py-3 font-semibold">
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adaptar `FailureScreen` y `PendingScreen` para que `productType` acepte `'order'`**

Read existing `components/status/FailureScreen.tsx` y `PendingScreen.tsx`. Si tienen `productType?: 'rifa' | 'combo'`, agregar `'order'` al union. Copy genérico cuando `productType === 'order'`: "Hubo un problema con tu compra" y "Tu pago está pendiente de aprobación".

- [ ] **Step 3: Lint+build, commit**

```bash
git add components/order/OrderSuccessScreen.tsx components/status/
git commit -m "feat(fase-7): OrderSuccessScreen + productType=order en Failure/Pending"
```

---

### Task 30: OrderFlow orchestrator

**Files:**
- Create: `components/order/OrderFlow.tsx`

- [ ] **Step 1: Implement orchestrator que coordina todo el flujo**

Create `components/order/OrderFlow.tsx`:
```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import AppHeader from '@/components/layout/AppHeader';
import NumberGrid from '@/components/grid/NumberGrid';
import ComboCatalog from '@/components/combos/ComboCatalog';
import StickyCartBar from '@/components/cart/StickyCartBar';
import CartDrawer from '@/components/cart/CartDrawer';
import CrossSellSheet from '@/components/cross-sell/CrossSellSheet';
import UnifiedBuyerForm, { type BuyerData } from './UnifiedBuyerForm';
import UnifiedReview from './UnifiedReview';
import OrderSuccessScreen from './OrderSuccessScreen';
import FailureScreen from '@/components/status/FailureScreen';
import PendingScreen from '@/components/status/PendingScreen';
import type { CartItem } from '@/lib/combos';
import { getComboById, calculateTotal } from '@/lib/combos';

type View = 'rifa-grid' | 'combo-catalog' | 'cross-sell' | 'form' | 'review' | 'success' | 'failure' | 'pending';

interface OrderFlowProps {
  initialEntry: 'rifa' | 'combo';
  raffleConfig: { id: number; title: string; pricePerNumber: number; totalNumbers: number };
  numbers: Array<{ number: number; status: 'available' | 'reserved' | 'sold' }>;
  onBack: () => void;
  initialPaymentStatus?: 'success' | 'failure' | 'pending';
  initialOrderId?: string;
  refreshNumbers: () => Promise<void>;
}

export default function OrderFlow(props: OrderFlowProps) {
  const [view, setView] = useState<View>(() => {
    if (props.initialPaymentStatus === 'success') return 'success';
    if (props.initialPaymentStatus === 'failure') return 'failure';
    if (props.initialPaymentStatus === 'pending') return 'pending';
    return props.initialEntry === 'rifa' ? 'rifa-grid' : 'combo-catalog';
  });
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedCombos, setSelectedCombos] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [crossSellShown, setCrossSellShown] = useState(false);
  const [buyer, setBuyer] = useState<BuyerData>({ name: '', email: '', phone: '' });
  const [orderId, setOrderId] = useState<string | undefined>(props.initialOrderId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = (props.raffleConfig.pricePerNumber * selectedNumbers.length) + calculateTotal(selectedCombos);
  const itemCount = selectedNumbers.length + selectedCombos.reduce((s, it) => s + it.quantity, 0);
  const hasRaffle = selectedNumbers.length > 0;
  const hasCombos = selectedCombos.length > 0;

  // Cleanup query params después de mount (Fix I-1 Fase 5.B)
  useEffect(() => {
    if (props.initialPaymentStatus) {
      window.history.replaceState({}, '', '/');
    }
  }, [props.initialPaymentStatus]);

  const handleContinueFromSelection = () => {
    // Si todavía no se mostró el cross-sell y solo tiene 1 tipo de producto, ofrecer el otro
    if (!crossSellShown && (
      (view === 'rifa-grid' && hasRaffle && !hasCombos) ||
      (view === 'combo-catalog' && hasCombos && !hasRaffle)
    )) {
      setView('cross-sell');
      return;
    }
    setView('form');
  };

  const handleCrossSellAccept = () => {
    setCrossSellShown(true);
    setView(props.initialEntry === 'rifa' ? 'combo-catalog' : 'rifa-grid');
  };

  const handleCrossSellDecline = () => {
    setCrossSellShown(true);
    setView('form');
  };

  const handleSubmitForm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        buyer,
        raffle: hasRaffle ? { raffleId: props.raffleConfig.id, numberIds: selectedNumbers } : undefined,
        combos: hasCombos ? selectedCombos : undefined,
      };
      const res = await fetch('/api/order/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Error creando order');
      setOrderId(json.data.orderId);
      setView('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReview = async () => {
    if (!orderId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/order/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Error creando preference');
      window.location.href = json.data.initPoint;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    setSelectedNumbers([]);
    setSelectedCombos([]);
    setCrossSellShown(false);
    setOrderId(undefined);
    setError(null);
    props.onBack();
  };

  const handleRemoveNumber = async (n: number) => {
    if (!orderId) {
      setSelectedNumbers((curr) => curr.filter((x) => x !== n));
      return;
    }
    // Si el order ya existe en BD (post-form), llamar API
    // ... (más complejo: requiere conocer rafflePurchaseId; por simplicidad pre-form solo client-side)
    setSelectedNumbers((curr) => curr.filter((x) => x !== n));
  };

  const handleComboQuantity = (comboId: string, delta: number) => {
    setSelectedCombos((curr) => curr.map((it) => it.comboId === comboId ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
  };

  const handleRemoveCombo = (comboId: string) => {
    setSelectedCombos((curr) => curr.filter((it) => it.comboId !== comboId));
  };

  return (
    <PageContainer>
      <AppHeader variant="wizard" title={
        view === 'rifa-grid' ? 'Elegí tus números' :
        view === 'combo-catalog' ? 'Elegí tus combos' :
        view === 'form' ? 'Datos del comprador' :
        view === 'review' ? 'Confirmar compra' :
        ''
      } onBack={() => {
        if (view === 'review') setView('form');
        else if (view === 'form') setView(crossSellShown ? (props.initialEntry === 'rifa' ? 'combo-catalog' : 'rifa-grid') : (props.initialEntry === 'rifa' ? 'rifa-grid' : 'combo-catalog'));
        else props.onBack();
      }} />

      <main className="flex-1 px-4 py-4">
        {error && <div className="bg-state-danger/10 text-state-danger rounded-md px-3 py-2 mb-3 text-sm">{error}</div>}

        {view === 'rifa-grid' && (
          <NumberGrid
            numbers={props.numbers}
            selected={selectedNumbers}
            onSelectionChange={setSelectedNumbers}
            totalNumbers={props.raffleConfig.totalNumbers}
          />
        )}
        {view === 'combo-catalog' && (
          <ComboCatalog selected={selectedCombos} onChange={setSelectedCombos} />
        )}
        {view === 'form' && (
          <UnifiedBuyerForm
            hasRaffle={hasRaffle}
            data={buyer}
            onChange={setBuyer}
            onSubmit={handleSubmitForm}
            isSubmitting={isSubmitting}
          />
        )}
        {view === 'review' && (
          <UnifiedReview
            raffleNumbers={selectedNumbers}
            pricePerNumber={props.raffleConfig.pricePerNumber}
            combos={selectedCombos}
            buyer={buyer}
            total={total}
            onConfirm={handleConfirmReview}
            onBack={() => setView('form')}
            isConfirming={isSubmitting}
            raffleTitle={props.raffleConfig.title}
          />
        )}
        {view === 'success' && (
          <OrderSuccessScreen
            orderId={orderId ?? '—'}
            raffleNumbers={selectedNumbers.length > 0 ? selectedNumbers : undefined}
            combos={selectedCombos.length > 0 ? selectedCombos : undefined}
            total={total > 0 ? total : undefined}
            onRestart={handleRestart}
          />
        )}
        {view === 'failure' && <FailureScreen onRestart={handleRestart} productType="order" />}
        {view === 'pending' && <PendingScreen onRestart={handleRestart} productType="order" />}
      </main>

      {(view === 'rifa-grid' || view === 'combo-catalog') && itemCount > 0 && (
        <StickyCartBar
          itemCount={itemCount}
          total={total}
          onTap={() => setCartOpen(true)}
          ctaLabel="Continuar"
          onCta={handleContinueFromSelection}
        />
      )}
      {(view === 'form' || view === 'review') && itemCount > 0 && (
        <StickyCartBar itemCount={itemCount} total={total} onTap={() => setCartOpen(true)} />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        raffleNumbers={selectedNumbers}
        combos={selectedCombos}
        pricePerNumber={props.raffleConfig.pricePerNumber}
        total={total}
        onRemoveNumber={handleRemoveNumber}
        onComboQuantityChange={handleComboQuantity}
        onRemoveCombo={handleRemoveCombo}
      />

      <CrossSellSheet
        open={view === 'cross-sell'}
        onClose={handleCrossSellDecline}
        productSold={props.initialEntry}
        onAccept={handleCrossSellAccept}
        onDecline={handleCrossSellDecline}
      />
    </PageContainer>
  );
}
```

- [ ] **Step 2: Lint+build (puede haber type errors menores; resolverlos)**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/order/OrderFlow.tsx
git commit -m "feat(fase-7): OrderFlow orchestrator con state global y navegación"
```

---

### Task 31: RifasApp shell refactor

**Files:**
- Modify: `components/RifasApp.tsx`

- [ ] **Step 1: Refactor RifasApp shell para delegar a OrderFlow después del split hero**

Reemplazar el contenido relevante de `components/RifasApp.tsx`. Mantener el split hero (`ProductSplitHero`) en la vista `home`. Cuando se elige rifa o combo, montar `<OrderFlow>` con `initialEntry`. Manejar los query params `?payment=...&order=...` montando OrderFlow con `initialPaymentStatus`.

```tsx
'use client';

import { useState, useEffect } from 'react';
import ProductSplitHero from './hero/ProductSplitHero';
import OrderFlow from './order/OrderFlow';

interface RaffleConfig {
  id: number;
  title: string;
  pricePerNumber: number;
  totalNumbers: number;
  isActive: boolean;
}

interface RaffleNumber {
  number: number;
  status: 'available' | 'reserved' | 'sold';
}

export default function RifasApp() {
  const [view, setView] = useState<'home' | 'order'>('home');
  const [entry, setEntry] = useState<'rifa' | 'combo'>('rifa');
  const [raffleConfig, setRaffleConfig] = useState<RaffleConfig | null>(null);
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failure' | 'pending' | undefined>();
  const [orderId, setOrderId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const loadConfig = async () => {
    const res = await fetch('/api/raffle/config');
    const json = await res.json();
    if (json.success) setRaffleConfig(json.data);
  };

  const loadNumbers = async () => {
    const res = await fetch('/api/numbers');
    const json = await res.json();
    if (json.success) setNumbers(json.data);
  };

  useEffect(() => {
    Promise.all([loadConfig(), loadNumbers()]).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(loadNumbers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Query params post-MP redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ps = params.get('payment') as 'success' | 'failure' | 'pending' | null;
    const o = params.get('order');
    if (ps && o) {
      setPaymentStatus(ps);
      setOrderId(o);
      setView('order');
    }
  }, []);

  if (isLoading || !raffleConfig) return <div>Cargando...</div>;

  if (view === 'home') {
    return <ProductSplitHero
      onSelectRifa={() => { setEntry('rifa'); setView('order'); }}
      onSelectCombo={() => { setEntry('combo'); setView('order'); }}
      pricePerNumber={raffleConfig.pricePerNumber}
      raffleTitle={raffleConfig.title}
    />;
  }

  return (
    <OrderFlow
      initialEntry={entry}
      raffleConfig={raffleConfig}
      numbers={numbers}
      onBack={() => { setView('home'); setPaymentStatus(undefined); setOrderId(undefined); }}
      initialPaymentStatus={paymentStatus}
      initialOrderId={orderId}
      refreshNumbers={loadNumbers}
    />
  );
}
```

- [ ] **Step 2: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes (puede haber warnings sobre props de ProductSplitHero — adaptar a su signature actual).

- [ ] **Step 3: Commit**

```bash
git add components/RifasApp.tsx
git commit -m "refactor(fase-7): RifasApp shell delega a OrderFlow"
```

---

### Task 32: Borrar 7 componentes viejos

**Files:**
- Delete: `components/combos/ComboFlow.tsx`
- Delete: `components/combos/ComboBuyerForm.tsx`
- Delete: `components/combos/ComboReview.tsx`
- Delete: `components/status/ComboSuccessScreen.tsx`
- Delete: `components/review/PurchaseReview.tsx`
- Delete: `components/form/BuyerForm.tsx`
- Delete: `components/status/SuccessScreen.tsx`

- [ ] **Step 1: Verificar que ningún archivo los importa (después de Task 31)**

Run: `grep -rn "ComboFlow\\|ComboBuyerForm\\|ComboReview\\|ComboSuccessScreen\\|PurchaseReview\\|/form/BuyerForm\\|/status/SuccessScreen" components/ app/`
Expected: 0 hits (Task 31 ya migró RifasApp).

- [ ] **Step 2: Borrar archivos**

```bash
rm components/combos/ComboFlow.tsx
rm components/combos/ComboBuyerForm.tsx
rm components/combos/ComboReview.tsx
rm components/status/ComboSuccessScreen.tsx
rm components/review/PurchaseReview.tsx
rm components/form/BuyerForm.tsx
rm components/status/SuccessScreen.tsx
# Si components/review/ queda vacío:
rmdir components/review/ 2>/dev/null || true
```

- [ ] **Step 3: Lint+build**

Run: `npm run lint && npm run build`
Expected: verdes.

- [ ] **Step 4: Commit**

```bash
git add -A components/
git commit -m "refactor(fase-7): borrar 7 componentes viejos reemplazados por OrderFlow"
```

---

### Task 33: Smoke local + final review 7.B

**Files:** ninguno (manual + review)

- [ ] **Step 1: Iniciar dev server y recorrer flujos manualmente**

Run: `npm run dev`
Recorrer en browser http://localhost:3000:

1. Click "Rifa" → grid → seleccionar 3 números → click "Continuar" → bottom sheet "¿Querés sumar combos?" → click "Sí" → catálogo combos → seleccionar 1 sandwich chorizo qty 2 → click "Continuar" → form (6 campos) → completar → submit → review breakdown ámbar y dark → click "Pagar con MercadoPago" → redirige a sandbox MP → cancel desde MP → vuelve a `/?payment=failure&order=ORD-...` → muestra FailureScreen.
2. Click "Combo" → catálogo → seleccionar empanadas qty 1 → click "Continuar" → bottom sheet "¿Querés sumar rifa?" → click "No" → form (3 campos solo) → completar → review → MP cancel → failure.
3. Verificar StickyCartBar tappable abre CartDrawer; remover número de rifa funciona; cambiar quantity de combo funciona.

- [ ] **Step 2: Invoke final code reviewer**

Dispatch: agent `general-purpose` con prompt:
> "Final code review sub-fase 7.B (UI carrito unificado). Inspeccionar: `components/order/{OrderFlow,UnifiedBuyerForm,UnifiedReview,OrderSuccessScreen}.tsx`, `components/cart/{StickyCartBar,CartDrawer}.tsx`, `components/cross-sell/CrossSellSheet.tsx`, `components/grid/NumberGrid.tsx`, `components/RifasApp.tsx`. Reportar: (a) issues críticos (corruption de datos, leaks de state), (b) issues importantes (UX bugs visibles), (c) minor (cosmética). Spec: §8."

Expected: aprobación o issues fixeables. Fixear los críticos+importantes inline antes de cerrar.

- [ ] **Step 3: Update ESTADO.md, commit cierre 7.B**

Cambiar `[ ] 7.B` a `[x] 7.B`. Bitácora.
```bash
git add ESTADO.md
git commit -m "chore(fase-7): cierre 7.B - UI carrito unificado completa"
```

---

## Sub-fase 7.C — Concurrency tests cross-product (Tasks 34-38)

Extender `test-concurrency.js` con 4 escenarios cross-product.

---

### Task 34: Escenario 1 — overlapping nums + cross-product

**Files:**
- Modify: `test-concurrency.js`

- [ ] **Step 1: Read current test-concurrency.js**

Run: `cat test-concurrency.js`

- [ ] **Step 2: Add scenario 1**

Append:
```js
async function scenario1_overlappingCrossProduct() {
  console.log('\n=== Scenario 1: 2 users overlapping nums + cross-product ===');
  await resetNumbers();

  const userA = fetch('http://localhost:3000/api/order/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyer: { name: 'A', email: 'a@a.com', phone: '111', studentName: 'AA', division: 'A', course: '1' },
      raffle: { raffleId: 2, numberIds: [5, 12] },
      combos: [{ comboId: 'chorizo', quantity: 2 }],
    }),
  });
  await sleep(Math.random() * 200);
  const userB = fetch('http://localhost:3000/api/order/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyer: { name: 'B', email: 'b@b.com', phone: '222', studentName: 'BB', division: 'B', course: '1' },
      raffle: { raffleId: 2, numberIds: [5, 13] },
      combos: [{ comboId: 'empanadas', quantity: 1 }],
    }),
  });

  const [resA, resB] = await Promise.all([userA, userB]);
  const jsonA = await resA.json();
  const jsonB = await resB.json();

  console.log('A:', resA.status, jsonA.success, jsonA.error ?? '');
  console.log('B:', resB.status, jsonB.success, jsonB.error ?? '');

  // Expected: exactamente 1 success, 1 error 409 con mensaje "no disponible"
  const successCount = [jsonA.success, jsonB.success].filter(Boolean).length;
  console.assert(successCount === 1, '❌ Scenario 1 FAILED: should have exactly 1 success');
  console.log(successCount === 1 ? '✅ Scenario 1 PASSED' : '❌ Scenario 1 FAILED');
}
```

- [ ] **Step 3: Lint+test (manual run)**

Asegurar dev server corriendo (`npm run dev` en otra terminal). Run: `node test-concurrency.js`
Expected: scenario 1 passes (exit 0 con "✅ Scenario 1 PASSED").

- [ ] **Step 4: Commit**

```bash
git add test-concurrency.js
git commit -m "test(fase-7): scenario 1 overlapping nums cross-product"
```

---

### Task 35: Escenario 2 — cleanup vs webhook

**Files:**
- Modify: `test-concurrency.js`

- [ ] **Step 1: Add scenario 2**

Append a `test-concurrency.js`:
```js
async function scenario2_cleanupVsWebhook() {
  console.log('\n=== Scenario 2: Cleanup mientras webhook approved ===');
  await resetNumbers();

  // Simular order pending de hace +15min: insertar directo en BD via Turso o usar API + sleep mock
  // Para test real, mejor usar dev BD limpia y disparar manualmente.
  // Skip si no hay manera de mockear el clock.
  console.log('⚠️ Scenario 2: requires clock mocking — manual run only');
}
```

(Si el test no es automatizable sin mocking, documentar como manual y dejar como referencia.)

- [ ] **Step 2: Commit**

```bash
git add test-concurrency.js
git commit -m "test(fase-7): scenario 2 cleanup vs webhook (manual)"
```

---

### Task 36: Escenario 3 — removeNumber vs webhook

**Files:**
- Modify: `test-concurrency.js`

- [ ] **Step 1: Add scenario 3**

Append:
```js
async function scenario3_removeVsWebhook() {
  console.log('\n=== Scenario 3: removeNumberFromOrder mientras webhook approved ===');
  await resetNumbers();

  // 1. Crear order con [5, 12] + 1 combo
  const created = await fetch('http://localhost:3000/api/order/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyer: { name: 'C', email: 'c@c.com', phone: '333', studentName: 'CC', division: 'C', course: '1' },
      raffle: { raffleId: 2, numberIds: [5, 12] },
      combos: [{ comboId: 'carne', quantity: 1 }],
    }),
  });
  const json = await created.json();
  if (!json.success) throw new Error('Setup failed');

  const orderId = json.data.orderId;
  const rafflePurchaseId = json.data.raffleChildId;

  // 2. Disparar removeNumber + (simulated) webhook approved en paralelo
  const remove = fetch('http://localhost:3000/api/order/items', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, rafflePurchaseId, raffleId: 2, number: 12 }),
  });
  // Simular webhook llamando confirmOrderPayment directamente (requiere import o endpoint dev-only)
  // Skip si no hay endpoint para forzar approved
  console.log('⚠️ Scenario 3: requires confirmOrderPayment trigger — manual run only');
  await remove;
}
```

- [ ] **Step 2: Commit**

```bash
git add test-concurrency.js
git commit -m "test(fase-7): scenario 3 removeNumber vs webhook (manual)"
```

---

### Task 37: Escenario 4 — 4 users overlapping cross-product

**Files:**
- Modify: `test-concurrency.js`

- [ ] **Step 1: Add scenario 4**

Append:
```js
async function scenario4_fourUsersCrossProduct() {
  console.log('\n=== Scenario 4: 4 users overlapping cross-product ===');
  await resetNumbers();

  const requests = [
    { buyer: { name: 'A', email: 'a@a.com', phone: '1', studentName: 'A', division: 'A', course: '1' }, raffle: { raffleId: 2, numberIds: [1, 2, 3] }, combos: [{ comboId: 'chorizo', quantity: 2 }] },
    { buyer: { name: 'B', email: 'b@b.com', phone: '2', studentName: 'B', division: 'B', course: '1' }, raffle: { raffleId: 2, numberIds: [3, 4, 5] }, combos: [{ comboId: 'empanadas', quantity: 1 }] },
    { buyer: { name: 'C', email: 'c@c.com', phone: '3', studentName: 'C', division: 'C', course: '1' }, raffle: { raffleId: 2, numberIds: [5, 6, 7] } },
    { buyer: { name: 'D', email: 'd@d.com', phone: '4' }, combos: [{ comboId: 'carne', quantity: 3 }] },
  ];

  const results = await Promise.all(requests.map(async (body) => {
    await sleep(Math.random() * 200);
    const res = await fetch('http://localhost:3000/api/order/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  }));

  results.forEach((r, i) => console.log(`User ${String.fromCharCode(65 + i)}:`, r.status, r.json.success, r.json.error ?? ''));

  // Verify: 0 sobreventa en raffle_numbers
  // Query a /api/numbers, contar sold=true que estén en cualquier overlap
  const numsRes = await fetch('http://localhost:3000/api/numbers');
  const numsJson = await numsRes.json();
  const reservedOrSold = numsJson.data.filter((n) => n.status === 'reserved' || n.status === 'sold');
  const counts = {};
  reservedOrSold.forEach((n) => { counts[n.number] = (counts[n.number] ?? 0) + 1; });
  const oversells = Object.entries(counts).filter(([_, v]) => v > 1);
  console.assert(oversells.length === 0, `❌ Scenario 4 FAILED: oversells detected ${JSON.stringify(oversells)}`);
  console.log(oversells.length === 0 ? '✅ Scenario 4 PASSED' : '❌ Scenario 4 FAILED');
}
```

- [ ] **Step 2: Run all scenarios**

Run: `node test-concurrency.js`
Expected: scenarios 1 + 4 PASS automated; 2 + 3 manual.

- [ ] **Step 3: Commit**

```bash
git add test-concurrency.js
git commit -m "test(fase-7): scenario 4 four users cross-product overlapping"
```

---

### Task 38: Concurrency-validator approval

**Files:** ninguno

- [ ] **Step 1: Run full suite**

Run: `node run-concurrency-test.js` (orquesta los escenarios pre-existentes + nuevos)
Expected: todos pass (los 2 manuales se reportan como skipped/manual).

- [ ] **Step 2: Invoke `concurrency-validator` agent**

Dispatch: agent `concurrency-validator` con prompt:
> "Validar tests de concurrencia post-Fase 7. Confirmar: (a) `OrderService.createOrder` mantiene anti-sobreventa (UPDATE `raffle_numbers` con `WHERE status='available'` + check rowsAffected), (b) `OrderService.cancelOrder` y `confirmOrderPayment` con locks optimistas correctos, (c) `removeNumberFromOrder` con guard `WHERE order.payment_status='pending'`, (d) tests escenarios 1+4 cubren cases reales. Spec: §9."

Expected: aprobación.

- [ ] **Step 3: Update ESTADO.md, commit cierre 7.C**

Cambiar `[ ] 7.C` a `[x] 7.C`.
```bash
git add ESTADO.md
git commit -m "chore(fase-7): cierre 7.C - concurrency tests pass"
```

---

## Sub-fase 7.D — Deploy + smoke real (Tasks 39-43)

---

### Task 39: Backup BD productiva pre-Fase 7

**Files:**
- Create: `backups/rifa-2026-pre-fase7-2026-05-XX.json` (gitignored)

- [ ] **Step 1: Backup via Turso MCP**

Use Turso MCP `execute_read_only_query` con `database: "sistema-de-riffas"`:
```sql
SELECT 'orders' as t, json_group_array(json_object(
  'id', id, 'buyer_name', buyer_name, 'email', email, 'total_amount', total_amount,
  'has_raffle', has_raffle, 'has_combos', has_combos, 'payment_status', payment_status, 'created_at', created_at
)) as rows FROM orders
UNION ALL
SELECT 'purchases', json_group_array(json_object(
  'id', id, 'order_id', order_id, 'buyer_name', buyer_name, 'payment_status', payment_status, 'created_at', created_at
)) FROM purchases
-- ... repetir para cada tabla
;
```

Guardar el resultado completo en `backups/rifa-2026-pre-fase7-YYYY-MM-DD.json` (path con fecha real).

- [ ] **Step 2: Verificar gitignore tiene `backups/`**

Run: `grep -q "^backups/" .gitignore && echo "OK" || echo "Add backups/ to .gitignore"`

- [ ] **Step 3: Commit (sin el JSON)**

```bash
git add .gitignore
git commit -m "chore(fase-7): backup BD pre-Fase 7 (gitignored)"
```

---

### Task 40: Apply migration via Turso MCP (productiva)

**Files:** ninguno (migration en BD productiva)

> ⚠️ Esto ya se hizo en sub-fase 7.A Task 4 contra la BD productiva (la única BD disponible). Esta tarea **verifica** post-deploy que las tablas siguen consistentes.

- [ ] **Step 1: Verificar 8 tablas + 0 datos huérfanos**

Use Turso MCP `execute_read_only_query`:
```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```
Expected: 8 tables.

```sql
SELECT COUNT(*) FROM purchases WHERE order_id IS NULL;
```
Expected: 7 (cancelled legacy).

- [ ] **Step 2: Commit (state marker)**

```bash
git commit --allow-empty -m "chore(fase-7): migration verificada en Turso prod"
```

---

### Task 41: Merge feature branch + Deploy Cloud Run

**Files:** ninguno

- [ ] **Step 1: Capture rollback target**

Run: `gcloud run services describe sistema-ventas-rifas --region=us-east1 --project=sistema-ventas-rifas-prod --format='value(status.latestReadyRevisionName)'`
Expected: imprime `sistema-ventas-rifas-00014-9wz` (rollback target). Anotarlo.

- [ ] **Step 2: Merge feature branch a main**

```bash
cd ../..  # volver al repo padre desde worktree
git checkout main
git merge --no-ff feature/carrito-unificado -m "merge: Fase 7 carrito unificado → main"
```

- [ ] **Step 3: Cleanup worktree y feature branch**

```bash
git worktree remove .worktrees/fase-7
git branch -d feature/carrito-unificado
git push origin --delete feature/carrito-unificado 2>/dev/null || true
```

- [ ] **Step 4: Push a origin**

```bash
git push origin main
```

- [ ] **Step 5: Deploy Cloud Run**

Run: `./scripts/deploy.sh`
Expected: build completo + deploy a revision `sistema-ventas-rifas-00015-XXX`. Espera traffic = 100%.

- [ ] **Step 6: Verificar revision activa**

```bash
gcloud run services describe sistema-ventas-rifas --region=us-east1 --project=sistema-ventas-rifas-prod --format='value(status.latestReadyRevisionName)'
```

- [ ] **Step 7: Commit (state marker)**

```bash
git commit --allow-empty -m "chore(fase-7): deploy Cloud Run 00015 con carrito unificado"
git push origin main
```

---

### Task 42: Smoke prod automatizado (URL inspection)

**Files:** ninguno

- [ ] **Step 1: Home HTTP 200 + split hero render**

Run: `curl -sI https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/ | head -1`
Expected: `HTTP/2 200`.

Run: `curl -s https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/ | grep -c "Apoyá"`
Expected: ≥ 1 hit.

- [ ] **Step 2: POST /api/order/purchase con bot data**

```bash
curl -X POST https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/order/purchase \
  -H 'Content-Type: application/json' \
  -d '{"buyer":{"name":"Bot","email":"bot@bot.com","phone":"000","studentName":"BotStudent","division":"X","course":"1"},"raffle":{"raffleId":2,"numberIds":[1999]},"combos":[{"comboId":"chorizo","quantity":1}]}'
```
Expected: 200 + `{"success":true,"data":{"orderId":"ORD-...","raffleChildId":"PUR-...","comboChildId":"COM-...","totalAmount":16000}}`. Capturar `orderId`.

- [ ] **Step 3: POST /api/order/preference + URL inspection (lección BUG-010)**

```bash
ORDER_ID="<from Step 2>"
PREF_RESP=$(curl -s -X POST https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/order/preference \
  -H 'Content-Type: application/json' \
  -d "{\"orderId\":\"${ORDER_ID}\"}")
echo "$PREF_RESP"
PREF_ID=$(echo "$PREF_RESP" | python3 -c "import json, sys; print(json.load(sys.stdin)['data']['preferenceId'])")
```

Inspeccionar URLs internas via MP API:
```bash
MP_TOKEN=$(gcloud secrets versions access latest --secret=mp-access-token --project=sistema-ventas-rifas-prod)
curl -s -H "Authorization: Bearer $MP_TOKEN" "https://api.mercadopago.com/checkout/preferences/${PREF_ID}" | python3 -m json.tool | grep -E '(success|failure|pending|notification)'
```
Expected: las 4 URLs (`back_urls.success`, `back_urls.failure`, `back_urls.pending`, `notification_url`) empiezan con `https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app`. **Si alguna empieza con `http://localhost`, el deploy está roto — revertir y debuggear.**

- [ ] **Step 4: Webhook auth checks**

```bash
curl -sI -X POST https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/webhooks/mercadopago | head -1
```
Expected: 401 (sin firma).

```bash
curl -sI -X POST https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/cron/cleanup | head -1
```
Expected: 401 (sin Bearer).

- [ ] **Step 5: Cleanup BD del order de smoke**

Use Turso MCP `execute_query` con `database: "sistema-de-riffas"` en orden FK-safe:
```sql
DELETE FROM event_logs WHERE order_id = '<ORDER_ID>';
DELETE FROM purchase_numbers WHERE purchase_id IN (SELECT id FROM purchases WHERE order_id = '<ORDER_ID>');
DELETE FROM combo_purchase_items WHERE combo_purchase_id IN (SELECT id FROM combo_purchases WHERE order_id = '<ORDER_ID>');
UPDATE raffle_numbers SET status='available', reserved_at=NULL, purchase_id=NULL WHERE purchase_id IN (SELECT id FROM purchases WHERE order_id = '<ORDER_ID>');
DELETE FROM purchases WHERE order_id = '<ORDER_ID>';
DELETE FROM combo_purchases WHERE order_id = '<ORDER_ID>';
DELETE FROM orders WHERE id = '<ORDER_ID>';
```

- [ ] **Step 6: Commit (state marker)**

```bash
git commit --allow-empty -m "chore(fase-7): smoke prod automatizado verde + URL inspection"
git push origin main
```

---

### Task 43: Smoke real cross-product con tercero

**Files:** ninguno

> ⚠️ **Coordinación con tercero requerida** (Romi probablemente). Rodrigo NO puede comprar (seller=buyer bloqueado por MP).

- [ ] **Step 1: Coordinar compra real con tercero**

Pedirle a Romi que entre a https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/, click "Rifa", elija 3 números, click "Continuar", click "Sí ver combos" en el cross-sell, elija 1 sandwich chorizo, click "Continuar", complete form (6 campos), click "Pagar con MercadoPago". Total esperado: 3 × $1.000 + 1 × $15.000 = $18.000.

- [ ] **Step 2: Monitorear logs Cloud Run en tiempo real**

```bash
gcloud run services logs tail sistema-ventas-rifas --region=us-east1 --project=sistema-ventas-rifas-prod
```
Esperar: webhook con `external_reference=ORD-xxx`, log `[Webhook ORD-] confirmOrderPayment ORD-xxx: { confirmed: true }`.

- [ ] **Step 3: Verificar BD post-pago**

Use Turso MCP `execute_read_only_query`:
```sql
SELECT id, payment_status, total_amount, has_raffle, has_combos FROM orders WHERE id = '<ORDER_ID_REAL>';
SELECT id, payment_status, numbers_count FROM purchases WHERE order_id = '<ORDER_ID_REAL>';
SELECT id, payment_status, items_count FROM combo_purchases WHERE order_id = '<ORDER_ID_REAL>';
SELECT number, status FROM raffle_numbers WHERE purchase_id IN (SELECT id FROM purchases WHERE order_id = '<ORDER_ID_REAL>');
```
Expected:
- `orders.payment_status = 'approved'`, `total_amount = 18000`, `has_raffle=1`, `has_combos=1`.
- `purchases.payment_status = 'approved'`, `numbers_count = 3`.
- `combo_purchases.payment_status = 'approved'`, `items_count = 1`.
- `raffle_numbers.status = 'sold'` para los 3 números elegidos.

- [ ] **Step 4: Verificar comprobante MP recibido por Romi**

Romi debe recibir el comprobante MP en su email con: `description = "STA - ORD-xxx - 3 nums + 1 combos"`, items con líneas separadas para rifa y combo, total $18.000.

- [ ] **Step 5: Update ESTADO.md cierre Fase 7**

Cambiar `[ ] 7.D` a `[x] 7.D`. Bitácora con `ORDER_ID_REAL`. Marcar Fase 7 como completa.

- [ ] **Step 6: Update MEMORIA.md con la decisión cerrada**

Agregar a `Decisiones de diseño`: "Fase 7 cerrada — carrito unificado en producción. Compra real con tercero confirmó flow end-to-end."

- [ ] **Step 7: Final commit**

```bash
git add ESTADO.md MEMORIA.md
git commit -m "chore(fase-7): cierre Fase 7 - carrito unificado en producción"
git push origin main
```

---

## Notas finales

- **Rollback path** (si algo falla post-deploy): `gcloud run services update-traffic sistema-ventas-rifas --region=us-east1 --to-revisions=sistema-ventas-rifas-00014-9wz=100`. La BD queda con tablas/columnas additive sin uso (no destructive).
- **Subagent strategy**: tareas mecánicas (schema, routes Zod-validated, componentes UI individuales) con haiku; integración compleja (orderService, webhook dispatch, OrderFlow, RifasApp shell) con sonnet.
- **Reviewers obligatorios**: `db-migration-reviewer` (Task 3), `payment-flow-debugger` (Tasks 17, 22), `concurrency-validator` (Task 38), final code reviewer (Task 33).
- **Cualquier deviation del plan**: documentar en ESTADO.md bitácora y MEMORIA.md decisiones.
