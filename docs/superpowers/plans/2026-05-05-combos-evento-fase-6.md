# Combos del evento Implementation Plan (Fase 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar venta online vía MercadoPago de 3 combos de comida ($15.000 c/u) integrados al sitio actual de la Rifa STA 2026, con flow paralelo al de rifa pero independiente (split entry en home, carrito multi-combo, pickup presencial).

**Architecture:** Tablas separadas (`combo_purchases` + `combo_purchase_items`) en Turso. Catálogo hardcoded en `lib/combos.ts`. Service layer espejo de `raffleService`. APIs nuevas bajo `/api/combo/*`. Webhook único reusado con dispatch por prefijo del `external_reference` (`PUR-` rifa / `COM-` combo). UI con split entry hero + wizard combos paralelo al wizard rifa. Reuse al 100% de `lib/webhook-verification.ts` (HMAC + idempotencia post-BUG-008).

**Tech Stack:** Next.js 14.2 App Router, TypeScript strict, Drizzle ORM 0.32 + Turso libSQL, MercadoPago SDK 2.0, Zod 3.23, Tailwind 3.4, nanoid 5.1, node:test built-in para unit tests.

**Spec:** `docs/superpowers/specs/2026-05-05-combos-evento-design.md`

**Prerequisitos**:
- Fase 5.B mergeada en main (revision actual `00013-529` con UI nueva en producción) ✓
- Fase 5.D paso (a)+(d) cerrados (merge + deploy + compra real Romi) ✓
- BD Turso con rifa 2026 limpia (2.000/2.000 disponibles a $1.000) ✓

---

## File Structure

**Nuevos archivos** (✚) y modificaciones (⚙):

```
components/
├── hero/
│   ├── HeroLanding.tsx              ❌ borrar (reemplazado por ProductSplitHero)
│   └── ProductSplitHero.tsx         ✚ dos cards (Rifa / Combo)
├── combos/                          ✚ directorio
│   ├── ComboFlow.tsx                ✚ orchestrator del wizard combos
│   ├── ComboCatalog.tsx             ✚ pantalla catálogo
│   ├── ComboRow.tsx                 ✚ fila individual con stepper
│   ├── ComboBuyerForm.tsx           ✚ form 3 fields
│   └── ComboReview.tsx              ✚ resumen + CTA pagar
├── status/
│   ├── FailureScreen.tsx            ⚙ +productType prop
│   ├── PendingScreen.tsx            ⚙ +productType prop
│   └── ComboSuccessScreen.tsx       ✚ COM-xxxx + breakdown items
└── RifasApp.tsx                     ⚙ +view state, render branches

lib/
├── combos.ts                        ✚ const COMBOS + helpers
├── services/comboService.ts         ✚ create/confirm/cancel/get
├── db/schema.ts                     ⚙ +comboPurchases, +comboPurchaseItems
└── mercadopago.ts                   ⚙ +createComboPreference

app/api/combo/                       ✚ directorio
├── purchase/route.ts                ✚
├── preference/route.ts              ✚
├── cancel/route.ts                  ✚
└── payment/{success,failure,pending}/route.ts  ✚

app/api/webhooks/mercadopago/route.ts  ⚙ dispatch por prefijo

tests/combo-service.test.mjs         ✚ unit tests
```

---

## Convenciones del codebase a seguir

- **Drizzle column types**: `real` para amounts (no `integer`), `text` con enum union para statuses, `integer mode:'timestamp'` para fechas, `default(sql\`CURRENT_TIMESTAMP\`)` para createdAt/updatedAt. Match exact con `lib/db/schema.ts` líneas 4-63.
- **Service layer**: `RaffleService` es una clase con métodos `static`. Replicar el patrón en `ComboService`.
- **API routes**: `export const dynamic = 'force-dynamic'` y `export const revalidate = 0` en TODAS las routes que tocan BD (regla CLAUDE).
- **Logging**: `console.log/error` con prefijos descriptivos (matches existing).
- **Errores en catch**: `error: unknown`, narrow con `error instanceof Error`.
- **Validación**: Zod en API routes antes de tocar BD.
- **IDs**: `nanoid(8)` para `COM-{nanoid}` (matches `PUR-{nanoid(8)}`).
- **Imports**: relativos (no path aliases).
- **MP preference URLs**: derivan de `process.env.NEXT_PUBLIC_BASE_URL` con fallback al dominio Cloud Run real (NO localhost — lección BUG-010).

---

## Task 1: Setup worktree, branch, ESTADO.md

**Files:**
- Create worktree at `.worktrees/fase-6` with branch `feature/combos-evento`
- Modify: `ESTADO.md` (agregar Fase 6 al checklist)

- [ ] **Step 1: Crear worktree aislado**

```bash
git worktree add -b feature/combos-evento .worktrees/fase-6 main
cd .worktrees/fase-6
```

- [ ] **Step 2: Crear `.eslintrc.json` del worktree con `root: true`**

```bash
echo '{"root": true, "extends": ["next/core-web-vitals"]}' > .worktrees/fase-6/.eslintrc.json
```

(Lección worktree nested: `next lint` walk-up detecta dos eslintrc y se queja. `root: true` corta el walk-up.)

- [ ] **Step 3: Actualizar ESTADO.md en el worktree con Fase 6**

Agregar la siguiente sección al ESTADO.md después de la Fase 5.E pendiente:

```markdown
### Fase 6: Combos del evento (venta online MP)
> Spec aprobado: `docs/superpowers/specs/2026-05-05-combos-evento-design.md`. Sumar venta online de 3 combos de comida ($15.000 c/u, sandwich chorizo / sandwich carne / 3 empanadas) integrada al sitio actual con UI split entry. Pickup presencial el día del evento contra nombre + COM-code.

- [ ] 6.0 Spec aprobado (2026-05-05) - DEV
- [ ] 6.A Server-side: schema + service + APIs + webhook dispatch - DEV
- [ ] 6.B UI: ProductSplitHero + ComboFlow + 5 componentes nuevos - DEV
- [ ] 6.C Sandbox MP smoke E2E - TEST
- [ ] 6.D Deploy + compra real $15.000 - TEST
```

- [ ] **Step 4: Commit setup**

```bash
git add .eslintrc.json ESTADO.md
git commit -m "chore: setup worktree fase 6 + ESTADO.md updated

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Fase 6.A · Server-side foundations

## Task 2: `lib/combos.ts` (catálogo + helpers, TDD)

**Files:**
- Create: `lib/combos.ts`
- Test: `tests/combos.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `tests/combos.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBOS, getComboById, calculateTotal } from '../lib/combos.ts';

test('COMBOS contiene 3 entradas con precio 15000', () => {
  assert.equal(COMBOS.length, 3);
  for (const combo of COMBOS) {
    assert.equal(combo.price, 15000);
  }
});

test('getComboById devuelve combo correcto', () => {
  const combo = getComboById('chorizo');
  assert.ok(combo);
  assert.equal(combo.name, 'Sandwich de chorizo');
});

test('getComboById devuelve null para id inválido', () => {
  assert.equal(getComboById('pizza'), null);
});

test('calculateTotal suma cart items correctamente', () => {
  const total = calculateTotal([
    { comboId: 'chorizo', quantity: 2 },
    { comboId: 'empanadas', quantity: 1 },
  ]);
  assert.equal(total, 45000);
});

test('calculateTotal con cart vacío devuelve 0', () => {
  assert.equal(calculateTotal([]), 0);
});

test('calculateTotal ignora comboIds inválidos', () => {
  const total = calculateTotal([
    { comboId: 'chorizo', quantity: 1 },
    { comboId: 'invalid', quantity: 5 },
  ]);
  assert.equal(total, 15000);
});
```

- [ ] **Step 2: Run tests — fail expected**

```bash
node --test --experimental-strip-types tests/combos.test.mjs
```

Expected: FAIL with "Cannot find module '../lib/combos'".

- [ ] **Step 3: Implement `lib/combos.ts`**

```ts
export const COMBOS = [
  { id: 'chorizo',   name: 'Sandwich de chorizo', description: '+ vaso de gaseosa', price: 15000, emoji: '🥪' },
  { id: 'carne',     name: 'Sandwich de carne',   description: '+ vaso de gaseosa', price: 15000, emoji: '🍖' },
  { id: 'empanadas', name: '3 empanadas',         description: '+ vaso de gaseosa', price: 15000, emoji: '🥟' },
] as const;

export type ComboId = typeof COMBOS[number]['id'];

export type Combo = typeof COMBOS[number];

export interface CartItem {
  comboId: ComboId | string;
  quantity: number;
}

export function getComboById(id: string): Combo | null {
  return COMBOS.find((c) => c.id === id) ?? null;
}

export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const combo = getComboById(item.comboId);
    if (!combo) return sum;
    return sum + combo.price * item.quantity;
  }, 0);
}
```

- [ ] **Step 4: Run tests — pass expected**

```bash
node --test --experimental-strip-types tests/combos.test.mjs
```

Expected: 6 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add lib/combos.ts tests/combos.test.mjs
git commit -m "feat(combos): catalog constant + helpers with TDD

3 combos hardcoded a \$15.000 c/u (chorizo, carne, empanadas).
Helpers getComboById + calculateTotal con 6 tests unitarios.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Drizzle schema additions + db:generate

**Files:**
- Modify: `lib/db/schema.ts` (agregar 2 tablas al final)

- [ ] **Step 1: Append a `lib/db/schema.ts` las tablas nuevas**

Agregar después de la definición de `eventLogs` (línea 63):

```ts
export const comboPurchases = sqliteTable('combo_purchases', {
  id: text('id').primaryKey(),
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

NOTA: `event_logs.purchase_id` queda intacto. Reusamos la columna como genérica (FK declarada se mantiene; SQLite no enforce por default y el campo acepta `COM-xxx` sin error porque es text).

- [ ] **Step 2: Verificar export del schema**

`lib/db/index.ts` re-exporta el schema completo via `import * as schema from './schema'`. Las nuevas tablas aparecen automáticamente como `schema.comboPurchases` y `schema.comboPurchaseItems`. No hay que tocar nada más.

- [ ] **Step 3: Generar migración**

```bash
npm run db:generate
```

Expected output: nueva migración en `drizzle/` con 2 `CREATE TABLE` statements (combo_purchases + combo_purchase_items).

- [ ] **Step 4: Inspeccionar SQL generada**

Read el archivo nuevo en `drizzle/` (probablemente `drizzle/0001_*.sql` o similar). Verificar:
- Solo CREATE TABLE para combo_purchases + combo_purchase_items
- Sin DROP, sin ALTER de tablas existentes
- FK reference correcta `combo_purchase_items.combo_purchase_id → combo_purchases.id`

Si la migración tiene cualquier statement destructivo o toca tablas existentes, **STOP** y reportar al usuario.

- [ ] **Step 5: Commit schema + migración**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(db): schema combo_purchases + combo_purchase_items

Tablas paralelas a purchases para venta de combos.
Migración generada con drizzle-kit, solo CREATE TABLE
(non-destructiva sobre tablas existentes).

Pendiente db-migration-reviewer agent + db:migrate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Pasar migración por `db-migration-reviewer` + apply a Turso

**Files:**
- Reviewer agent + `npm run db:migrate`

- [ ] **Step 1: Invocar agent `db-migration-reviewer`**

Usar el tool Agent con `subagent_type: db-migration-reviewer` y prompt:

```
Revisar la migración generada en `drizzle/0001_*.sql` (o el archivo más reciente). Contexto:

- Es la primera migración después del setup inicial de la rifa 2026
- Agrega 2 tablas nuevas: combo_purchases + combo_purchase_items
- NO toca tablas existentes (raffles, raffle_numbers, purchases, purchase_numbers, event_logs)
- BD productiva está activa con 1 rifa, 2000 raffle_numbers disponibles, 0 sold/reserved

Verificar:
1. SQL no es destructivo
2. CREATE TABLE no choca con tablas existentes
3. FKs correctas (combo_purchase_items.combo_purchase_id → combo_purchases.id)
4. Tipos coinciden con la convención del schema (real para amounts, integer mode timestamp para dates)
5. Es idempotente / safe to apply en producción sin downtime

Reportar GO o STOP con razón.
```

- [ ] **Step 2: Solo si reviewer dice GO, aplicar migración a Turso**

```bash
npm run db:migrate
```

Expected output: confirmación de migración aplicada sin errores. Si falla, **STOP** y reportar.

- [ ] **Step 3: Verificar tablas en Turso**

Vía Turso MCP:

```
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'combo_%';
```

Expected: 2 filas (`combo_purchases`, `combo_purchase_items`).

```
SELECT COUNT(*) FROM combo_purchases;
SELECT COUNT(*) FROM combo_purchase_items;
```

Expected: 0 / 0 (tablas vacías).

- [ ] **Step 4: Commit confirmation**

```bash
git commit --allow-empty -m "chore(db): migration applied a Turso productivo

combo_purchases y combo_purchase_items creadas en BD productiva,
ambas vacías. db-migration-reviewer aprobó previamente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `lib/services/comboService.ts` con TDD

**Files:**
- Create: `lib/services/comboService.ts`
- Test: `tests/combo-service.test.mjs`

NOTA: este test puede correr contra una BD test local o requerir setup de fixtures. Si el codebase actual no tiene un test runner DB-aware, los tests pueden ser de la lógica pura (calculateTotal, validateItems) y dejar la integración BD para el smoke E2E del Task 20. Decidir según el patrón existente (chequear `tests/run-tests.sh`).

Para este plan asumimos tests unitarios de lógica + integration tests delegados al smoke. Tests cubren la lógica anti-tampering.

- [ ] **Step 1: Write failing tests for service logic**

Create `tests/combo-service.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal, getComboById } from '../lib/combos.ts';

// Tests focales en la lógica server-side de validación.
// La integración con BD se cubre en smoke E2E (Task 20).

test('server total recalcula desde COMBOS, ignora total del cliente', () => {
  // Cliente envía items + un total falso. Server lo recalcula.
  const clientItems = [
    { comboId: 'chorizo', quantity: 2 },    // 30000
    { comboId: 'empanadas', quantity: 1 },  // 15000
  ];
  const clientFakeTotal = 1; // intenta tampering

  const serverTotal = calculateTotal(clientItems);
  assert.notEqual(serverTotal, clientFakeTotal);
  assert.equal(serverTotal, 45000);
});

test('comboId inválido se ignora (no contribuye al total)', () => {
  const items = [
    { comboId: 'chorizo', quantity: 1 },
    { comboId: 'pizza', quantity: 99 }, // invalid
  ];
  assert.equal(calculateTotal(items), 15000);
});

test('quantity 0 no contribuye al total', () => {
  const items = [
    { comboId: 'chorizo', quantity: 0 },
    { comboId: 'carne', quantity: 1 },
  ];
  assert.equal(calculateTotal(items), 15000);
});

test('getComboById ignora case-sensitivity strict', () => {
  assert.equal(getComboById('Chorizo'), null);
  assert.ok(getComboById('chorizo'));
});
```

- [ ] **Step 2: Run tests**

```bash
node --test --experimental-strip-types tests/combo-service.test.mjs
```

Expected: PASS (la lógica de calculateTotal ya pasó tests en Task 2; estos son redundantes pero docu-tests del comportamiento contractual del service).

- [ ] **Step 3: Implement `lib/services/comboService.ts`**

```ts
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { calculateTotal, getComboById, type CartItem } from '../combos';

const { comboPurchases, comboPurchaseItems, eventLogs } = schema;

export interface CreateComboPurchaseInput {
  buyer: { name: string; email: string; phone: string };
  items: CartItem[];
}

export class ComboService {
  static isDbAvailable() {
    return db !== null;
  }

  static async createComboPurchase(input: CreateComboPurchaseInput) {
    if (!this.isDbAvailable()) {
      throw new Error('Database not available');
    }

    // Filtrar items válidos (comboId existe + quantity > 0)
    const validItems = input.items.filter((item) => {
      if (item.quantity <= 0) return false;
      return getComboById(item.comboId) !== null;
    });

    if (validItems.length === 0) {
      throw new Error('No valid items in cart');
    }

    // Calcular total y count server-side (ignora cualquier dato del cliente)
    const totalAmount = calculateTotal(validItems);
    const itemsCount = validItems.reduce((sum, item) => sum + item.quantity, 0);

    const comboPurchaseId = `COM-${nanoid(8)}`;

    return db.transaction(async (tx) => {
      // Insert padre
      await tx.insert(comboPurchases).values({
        id: comboPurchaseId,
        buyerName: input.buyer.name,
        email: input.buyer.email,
        phone: input.buyer.phone,
        totalAmount,
        itemsCount,
        paymentStatus: 'pending'
      });

      // Insert hijos con snapshots de name+price
      for (const item of validItems) {
        const combo = getComboById(item.comboId)!; // verificado arriba
        await tx.insert(comboPurchaseItems).values({
          comboPurchaseId,
          comboId: combo.id,
          comboNameSnapshot: combo.name,
          unitPrice: combo.price,
          quantity: item.quantity
        });
      }

      // Audit log
      await tx.insert(eventLogs).values({
        eventType: 'COMBO_PURCHASE_CREATED',
        purchaseId: comboPurchaseId,
        data: JSON.stringify({ totalAmount, itemsCount, items: validItems })
      });

      return {
        id: comboPurchaseId,
        totalAmount,
        itemsCount,
        items: validItems
      };
    });
  }

  static async getComboPurchase(id: string) {
    if (!this.isDbAvailable()) return null;

    const [purchase] = await db
      .select()
      .from(comboPurchases)
      .where(eq(comboPurchases.id, id))
      .limit(1);

    if (!purchase) return null;

    const items = await db
      .select()
      .from(comboPurchaseItems)
      .where(eq(comboPurchaseItems.comboPurchaseId, id));

    return { ...purchase, items };
  }

  static async setMercadoPagoPreferenceId(comboPurchaseId: string, preferenceId: string) {
    if (!this.isDbAvailable()) return;

    await db
      .update(comboPurchases)
      .set({
        mercadoPagoPreferenceId: preferenceId,
        updatedAt: new Date()
      })
      .where(eq(comboPurchases.id, comboPurchaseId));
  }

  /**
   * Idempotente: si ya está approved, return early.
   * Optimistic lock: WHERE payment_status='pending' + verificar rowsAffected.
   */
  static async confirmComboPayment(params: {
    comboPurchaseId: string;
    paymentId: string;
    paymentMethod?: string;
  }) {
    if (!this.isDbAvailable()) return;

    return db.transaction(async (tx) => {
      // Read current state
      const [current] = await tx
        .select()
        .from(comboPurchases)
        .where(eq(comboPurchases.id, params.comboPurchaseId))
        .limit(1);

      if (!current) {
        throw new Error(`Combo purchase ${params.comboPurchaseId} not found`);
      }

      // Idempotency
      if (current.paymentStatus === 'approved') {
        console.log(`[ComboService] ${params.comboPurchaseId} already approved, no-op`);
        return { confirmed: false, reason: 'already_approved' };
      }

      // Optimistic lock UPDATE
      const result = await tx
        .update(comboPurchases)
        .set({
          paymentStatus: 'approved',
          mercadoPagoPaymentId: params.paymentId,
          paymentMethod: params.paymentMethod ?? null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(comboPurchases.id, params.comboPurchaseId),
            eq(comboPurchases.paymentStatus, 'pending')
          )
        );

      if (result.rowsAffected === 0) {
        // Otra request lo confirmó/cancelló entre el read y el update
        await tx.insert(eventLogs).values({
          eventType: 'COMBO_PAYMENT_CONFLICT',
          purchaseId: params.comboPurchaseId,
          data: JSON.stringify({ paymentId: params.paymentId, reason: 'rowsAffected=0' })
        });
        return { confirmed: false, reason: 'race_lost' };
      }

      // Audit
      await tx.insert(eventLogs).values({
        eventType: 'COMBO_PAYMENT_CONFIRMED',
        purchaseId: params.comboPurchaseId,
        data: JSON.stringify({ paymentId: params.paymentId, paymentMethod: params.paymentMethod })
      });

      return { confirmed: true };
    });
  }

  /**
   * Idempotente: solo cancela pendings.
   */
  static async cancelComboPayment(params: { comboPurchaseId: string; reason: string }) {
    if (!this.isDbAvailable()) return;

    return db.transaction(async (tx) => {
      const result = await tx
        .update(comboPurchases)
        .set({
          paymentStatus: 'cancelled',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(comboPurchases.id, params.comboPurchaseId),
            eq(comboPurchases.paymentStatus, 'pending')
          )
        );

      if (result.rowsAffected === 0) {
        return { cancelled: false, reason: 'not_pending' };
      }

      await tx.insert(eventLogs).values({
        eventType: 'COMBO_PAYMENT_CANCELLED',
        purchaseId: params.comboPurchaseId,
        data: JSON.stringify({ reason: params.reason })
      });

      return { cancelled: true };
    });
  }
}
```

- [ ] **Step 4: Lint + build después del nuevo file**

```bash
npm run lint && npm run build
```

Expected: clean. Si falla, fix issues antes de continuar.

- [ ] **Step 5: Commit**

```bash
git add lib/services/comboService.ts tests/combo-service.test.mjs
git commit -m "feat(combos): ComboService con createComboPurchase + confirm/cancel idempotentes

Patrón espejo de raffleService post-BUG-008:
- createComboPurchase calcula total server-side desde lib/combos
- confirmComboPayment con optimistic lock + audit log
- cancelComboPayment idempotente
- Event types con prefijo COMBO_ para auditoría

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `lib/mercadopago.ts` extensión - createComboPreference

**Files:**
- Modify: `lib/mercadopago.ts` (agregar función al final, antes del export)

- [ ] **Step 1: Agregar interface y función**

Agregar después de la función `getPurchaseIdFromPayment` (línea 152):

```ts
interface CreateComboPreferenceData {
  comboPurchaseId: string;
  buyerName: string;
  email: string;
  items: { id: string; name: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
}

/**
 * Crear preferencia MP para una compra de combos (multi-item).
 * URLs derivan de NEXT_PUBLIC_BASE_URL runtime — fallback a dominio Cloud Run real
 * (NUNCA localhost — lección BUG-010).
 */
export async function createComboPreference(data: CreateComboPreferenceData) {
  try {
    console.log('Creating MP combo preference for:', data.comboPurchaseId);

    const items: PreferenceItem[] = data.items.map((item) => ({
      id: item.id,
      title: `${item.name} (combo)`,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      currency_id: 'ARS'
    }));

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';

    const preferenceData = {
      items,
      payer: {
        name: data.buyerName,
        email: data.email
      },
      back_urls: {
        success: `${baseUrl}/api/combo/payment/success`,
        failure: `${baseUrl}/api/combo/payment/failure`,
        pending: `${baseUrl}/api/combo/payment/pending`
      },
      external_reference: data.comboPurchaseId,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      description: `Pedido ${data.comboPurchaseId} · Rifa STA 2026`,
      statement_descriptor: 'COMBO STA',
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
        default_installments: 1
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };

    const response = await preference.create({ body: preferenceData });

    console.log('MP combo preference created:', {
      id: response.id,
      init_point: response.init_point
    });

    return {
      preferenceId: response.id!,
      initPoint: response.init_point!,
      sandboxInitPoint: response.sandbox_init_point!
    };
  } catch (error) {
    console.error('Error creating MP combo preference:', error);
    throw new Error('Failed to create combo payment preference');
  }
}
```

- [ ] **Step 2: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/mercadopago.ts
git commit -m "feat(combos): createComboPreference helper en lib/mercadopago

Multi-item preference con back_urls a /api/combo/payment/*,
external_reference COM-xxx para webhook dispatch,
description con COM-code visible en comprobante MP del comprador.

URLs derivan de NEXT_PUBLIC_BASE_URL runtime (lección BUG-010).
Sin auto_return (workaround sandbox-MP).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `app/api/combo/purchase/route.ts`

**Files:**
- Create: `app/api/combo/purchase/route.ts`

- [ ] **Step 1: Implement endpoint**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ComboService } from '@/lib/services/comboService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PurchaseSchema = z.object({
  buyer: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().min(5).max(30)
  }),
  items: z.array(z.object({
    comboId: z.string().min(1),
    quantity: z.number().int().min(1).max(50)
  })).min(1).max(20)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PurchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await ComboService.createComboPurchase(parsed.data);

    return NextResponse.json(
      {
        success: true,
        comboPurchaseId: result.id,
        totalAmount: result.totalAmount,
        itemsCount: result.itemsCount
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      }
    );
  } catch (error) {
    console.error('[/api/combo/purchase] error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/combo/purchase/route.ts
git commit -m "feat(combos): API POST /api/combo/purchase

Crea combo_purchase + items en transacción server-side.
Zod valida buyer + items (min 1, max 20).
Quantity capped a 50 por item (anti-griefer).
Total recalculado server-side, ignora cualquier dato del cliente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `app/api/combo/preference/route.ts`

**Files:**
- Create: `app/api/combo/preference/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ComboService } from '@/lib/services/comboService';
import { createComboPreference } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PreferenceSchema = z.object({
  comboPurchaseId: z.string().regex(/^COM-/)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PreferenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const purchase = await ComboService.getComboPurchase(parsed.data.comboPurchaseId);
    if (!purchase) {
      return NextResponse.json(
        { success: false, error: 'Combo purchase not found' },
        { status: 404 }
      );
    }

    if (purchase.paymentStatus !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot create preference for ${purchase.paymentStatus} purchase` },
        { status: 409 }
      );
    }

    const items = purchase.items.map((item) => ({
      id: item.comboId,
      name: item.comboNameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }));

    const mpResult = await createComboPreference({
      comboPurchaseId: purchase.id,
      buyerName: purchase.buyerName,
      email: purchase.email,
      items,
      totalAmount: purchase.totalAmount
    });

    await ComboService.setMercadoPagoPreferenceId(purchase.id, mpResult.preferenceId);

    return NextResponse.json(
      {
        success: true,
        initPoint: mpResult.initPoint,
        sandboxInitPoint: mpResult.sandboxInitPoint,
        preferenceId: mpResult.preferenceId
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      }
    );
  } catch (error) {
    console.error('[/api/combo/preference] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create preference' },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 2: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/api/combo/preference/route.ts
git commit -m "feat(combos): API POST /api/combo/preference

Crea preference MP multi-item, persiste preferenceId en BD.
503 si MP API falla (no 500) para que el cliente sepa retry.
409 si la purchase no está en pending (edge case post-pago).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `app/api/combo/cancel/route.ts`

**Files:**
- Create: `app/api/combo/cancel/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ComboService } from '@/lib/services/comboService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CancelSchema = z.object({
  comboPurchaseId: z.string().regex(/^COM-/),
  reason: z.string().max(200).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const result = await ComboService.cancelComboPayment({
      comboPurchaseId: parsed.data.comboPurchaseId,
      reason: parsed.data.reason ?? 'user_navigated_away'
    });

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    console.error('[/api/combo/cancel] error:', error);
    return NextResponse.json({ success: false, error: 'Cancel failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Lint + build + commit**

```bash
npm run lint && npm run build
git add app/api/combo/cancel/route.ts
git commit -m "feat(combos): API POST /api/combo/cancel idempotente

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Callbacks `/api/combo/payment/{success,failure,pending}`

**Files:**
- Create: `app/api/combo/payment/success/route.ts`
- Create: `app/api/combo/payment/failure/route.ts`
- Create: `app/api/combo/payment/pending/route.ts`

NOTA: estos handlers son redirects "tontos". La verdad sobre el estado del pago la determina el webhook firmado, NO estos callbacks (regla CLAUDE).

- [ ] **Step 1: Implement success handler**

`app/api/combo/payment/success/route.ts`:

```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const externalRef = url.searchParams.get('external_reference') ?? '';
  const paymentId = url.searchParams.get('payment_id') ?? '';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  const redirect = new URL(baseUrl);
  redirect.searchParams.set('combo', 'success');
  redirect.searchParams.set('order', externalRef);
  if (paymentId) redirect.searchParams.set('payment_id', paymentId);

  return NextResponse.redirect(redirect.toString());
}
```

- [ ] **Step 2: Implement failure handler (idéntico con `combo=failure`)**

`app/api/combo/payment/failure/route.ts`:

```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const externalRef = url.searchParams.get('external_reference') ?? '';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  const redirect = new URL(baseUrl);
  redirect.searchParams.set('combo', 'failure');
  redirect.searchParams.set('order', externalRef);

  return NextResponse.redirect(redirect.toString());
}
```

- [ ] **Step 3: Implement pending handler**

`app/api/combo/payment/pending/route.ts`:

```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const externalRef = url.searchParams.get('external_reference') ?? '';
  const paymentId = url.searchParams.get('payment_id') ?? '';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  const redirect = new URL(baseUrl);
  redirect.searchParams.set('combo', 'pending');
  redirect.searchParams.set('order', externalRef);
  if (paymentId) redirect.searchParams.set('payment_id', paymentId);

  return NextResponse.redirect(redirect.toString());
}
```

- [ ] **Step 4: Lint + build + commit**

```bash
npm run lint && npm run build
git add app/api/combo/payment/
git commit -m "feat(combos): callbacks back_urls /api/combo/payment/{success,failure,pending}

Redirects tontos a / con query params combo=...&order=COM-xxx.
La UI consume y limpia los params (patrón fix I-1 Fase 5.B).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Webhook dispatch update

**Files:**
- Modify: `app/api/webhooks/mercadopago/route.ts`

CRÍTICO: este es el cambio más sensible del Fase 6.A. El webhook actual maneja rifa con confirmPayment del raffleService. Hay que agregar un dispatch al inicio basado en el prefijo de `external_reference`. **NO TOCAR** la verificación HMAC, idempotencia, ni manejo de errores 5xx (post-BUG-008). El cambio es localizado.

- [ ] **Step 1: Read el webhook actual completo**

```bash
# Leer todo el archivo para entender el flow exacto
```

Ubicar el bloque donde se llama `RaffleService.confirmPayment(...)` o equivalente. El cambio mínimo es: ANTES de llamar al confirm, switch por prefijo del external_reference.

- [ ] **Step 2: Aplicar el dispatch**

Pseudocódigo del cambio (ubicar en el handler donde se procesa el payment confirmado, después de la firma HMAC + paymentInfo fetch):

```ts
// Pre-cambio:
// const purchaseId = paymentInfo.externalReference;
// await RaffleService.confirmPayment({ purchaseId, paymentId, paymentMethod });

// Post-cambio:
const externalRef = paymentInfo.externalReference;

if (!externalRef) {
  // Sin external_reference no podemos dispatch — log y 200 OK (no retry)
  await logEventLog({ eventType: 'UNKNOWN_REFERENCE', purchaseId: null, data: JSON.stringify({ paymentId }) });
  return NextResponse.json({ ok: true, dispatched: 'unknown' });
}

if (externalRef.startsWith('PUR-')) {
  // Flow rifa existente
  await RaffleService.confirmPayment({
    purchaseId: externalRef,
    paymentId,
    paymentMethod
  });
} else if (externalRef.startsWith('COM-')) {
  // Flow combos nuevo
  const { ComboService } = await import('@/lib/services/comboService');
  await ComboService.confirmComboPayment({
    comboPurchaseId: externalRef,
    paymentId,
    paymentMethod
  });
} else {
  // Prefijo desconocido — log + 200 OK
  await logEventLog({
    eventType: 'UNKNOWN_REFERENCE',
    purchaseId: externalRef,
    data: JSON.stringify({ paymentId, externalRef })
  });
  return NextResponse.json({ ok: true, dispatched: 'unknown_prefix' });
}
```

NOTA SOBRE PAYMENTS REJECTED: el handler actual probablemente solo confirma en payment.status === 'approved'. Para combos hacer lo mismo: si payment.status === 'rejected' || 'cancelled', llamar `cancelComboPayment` (paralelo al cancelPayment del raffle). Replicar EXACTAMENTE el patrón del raffle handler para no introducir asimetría.

- [ ] **Step 3: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Smoke local del dispatch**

Con dev server corriendo, simular un webhook con `external_reference: 'PUR-test'`:

```bash
# El webhook va a fallar la verificación HMAC porque la firma es falsa,
# pero el log debería mostrar que llegó al dispatch.
curl -X POST http://localhost:3000/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=1,v1=fake" \
  -H "x-request-id: test-1" \
  -d '{"data":{"id":"123"},"type":"payment"}'
```

Expected: 401 (firma inválida — eso valida que el path HMAC sigue funcionando).

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/mercadopago/route.ts
git commit -m "feat(combos): webhook dispatch por prefijo external_reference

PUR-xxx → RaffleService.confirmPayment (existente)
COM-xxx → ComboService.confirmComboPayment (nuevo)
otro     → log UNKNOWN_REFERENCE + 200 OK (no retry)

HMAC verification, idempotencia, manejo 5xx — intactos.
Cambio localizado al post-verify dispatch. Lección BUG-008 preservada.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Cierre Fase 6.A · validación + commit final

- [ ] **Step 1: Lint + build verde**

```bash
npm run lint && npm run build
```

- [ ] **Step 2: Tests unitarios verdes**

```bash
node --test --experimental-strip-types tests/combos.test.mjs tests/combo-service.test.mjs
```

Expected: ALL PASS.

- [ ] **Step 3: Smoke endpoint manual con dev server**

En 2 shells:

Shell 1:
```bash
npm run dev
```

Shell 2:
```bash
# Crear combo_purchase
curl -X POST http://localhost:3000/api/combo/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "buyer": { "name": "Test User", "email": "test@test.local", "phone": "1112345678" },
    "items": [
      { "comboId": "chorizo", "quantity": 2 },
      { "comboId": "empanadas", "quantity": 1 }
    ]
  }'
```

Expected: `{"success":true, "comboPurchaseId":"COM-...", "totalAmount":45000, "itemsCount":3}`

- [ ] **Step 4: Smoke preference creation**

```bash
# Reemplazar COM-xxx con el ID del paso anterior
curl -X POST http://localhost:3000/api/combo/preference \
  -H "Content-Type: application/json" \
  -d '{"comboPurchaseId":"COM-xxx"}'
```

Expected: `{"success":true, "initPoint":"https://...", "sandboxInitPoint":"https://...", "preferenceId":"..."}`

- [ ] **Step 5: Verificar URLs internas del preference vía MP API** (lección BUG-010)

```bash
MP_TOKEN=$(grep MERCADO_PAGO_ACCESS_TOKEN .env.local | cut -d= -f2)
PREF_ID="paste-preference-id-here"
curl -sS -H "Authorization: Bearer $MP_TOKEN" \
  "https://api.mercadopago.com/checkout/preferences/$PREF_ID" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print('back_urls:', d['back_urls']); print('notification_url:', d['notification_url']); print('description:', d['description'])"
```

Expected:
- `back_urls.success/failure/pending` empiezan con `http://localhost:3000/api/combo/payment/...` (en dev) o con dominio Cloud Run en prod
- `notification_url` apunta a `/api/webhooks/mercadopago`
- `description` contiene el `COM-xxx`

Si alguna URL es vacía o tiene `localhost` siendo el contexto producción, **STOP** — bug similar a BUG-010 detectado.

- [ ] **Step 6: Cleanup BD test**

Vía Turso MCP:
```sql
DELETE FROM combo_purchase_items WHERE combo_purchase_id LIKE 'COM-%';
DELETE FROM event_logs WHERE event_type LIKE 'COMBO_%';
DELETE FROM combo_purchases;
```

- [ ] **Step 7: Marcar Fase 6.A completa en ESTADO.md y commit**

```bash
# Cambiar [ ] 6.A → [x] 6.A
git add ESTADO.md
git commit -m "chore: Fase 6.A cerrada (server-side combos completo)

Schema en Turso, service idempotente, 4 APIs combo, webhook dispatch.
Smoke E2E manual verde con verificación de URLs vía MP API
(lección BUG-010). Tests unitarios verdes. Lint + build verde.

Próximo: Fase 6.B UI con ProductSplitHero + ComboFlow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Fase 6.B · UI

## Task 13: `<ProductSplitHero>` + RifasApp view state + delete HeroLanding

**Files:**
- Create: `components/hero/ProductSplitHero.tsx`
- Modify: `components/RifasApp.tsx` (add view state, render branches)
- Delete: `components/hero/HeroLanding.tsx`

- [ ] **Step 1: Crear `<ProductSplitHero>`**

```tsx
'use client';

import { Ticket, UtensilsCrossed } from 'lucide-react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';

interface ProductSplitHeroProps {
  raffleAvailable: number | null;
  rafflePrice: number | null;
  onSelect: (product: 'rifa' | 'combo') => void;
}

export default function ProductSplitHero({ raffleAvailable, rafflePrice, onSelect }: ProductSplitHeroProps) {
  const formatPrice = (n: number | null) =>
    n === null ? '—' : `$${n.toLocaleString('es-AR')}`;

  return (
    <PageContainer>
      <AppHeader variant="hero" />
      <main className="px-5 pt-6 pb-10">
        <h1 className="text-2xl font-black tracking-tight text-ink mb-2">Apoyá el evento</h1>
        <p className="text-sm text-ink-muted mb-6">
          Elegí qué querés comprar
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelect('rifa')}
            className="rounded-2xl border-2 border-brand bg-surface-raised p-4 text-left flex flex-col items-start gap-2 transition active:scale-[0.98]"
            aria-label="Comprar número de rifa"
          >
            <Ticket className="h-7 w-7 text-brand" aria-hidden />
            <div className="text-sm font-bold text-ink">Número de rifa</div>
            <div className="text-xs text-ink-muted">
              {raffleAvailable !== null ? `${raffleAvailable} disp.` : 'Cargando…'}
            </div>
            <div className="text-lg font-black text-brand">{formatPrice(rafflePrice)}</div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('combo')}
            className="rounded-2xl border border-ink-faint bg-surface-raised p-4 text-left flex flex-col items-start gap-2 transition active:scale-[0.98]"
            aria-label="Comprar combo de comida"
          >
            <UtensilsCrossed className="h-7 w-7 text-ink" aria-hidden />
            <div className="text-sm font-bold text-ink">Combo evento</div>
            <div className="text-xs text-ink-muted">3 opciones</div>
            <div className="text-lg font-black text-ink">$15.000</div>
          </button>
        </div>
      </main>
    </PageContainer>
  );
}
```

- [ ] **Step 2: Modificar `RifasApp.tsx` con view state**

Read el archivo actual. En la parte del state, agregar:

```tsx
const [view, setView] = useState<'home' | 'rifa' | 'combo'>('home');
```

Y en el render principal, ANTES del switch de currentStep existente, agregar:

```tsx
if (view === 'home') {
  return (
    <ProductSplitHero
      raffleAvailable={raffleConfig ? totalAvailable : null}
      rafflePrice={raffleConfig?.pricePerNumber ?? null}
      onSelect={(product) => setView(product)}
    />
  );
}

if (view === 'combo') {
  return <ComboFlow onExit={() => setView('home')} raffleConfig={raffleConfig} />;
}

// view === 'rifa' → resto del JSX existente del wizard rifa intacto
```

NOTA: `<ComboFlow>` se crea en Task 18; por ahora el import puede ser un stub `<div>ComboFlow placeholder</div>` o usar dynamic import con fallback.

Para el primer commit de este task, usar un stub:

```tsx
// Top of RifasApp.tsx, junto a otros imports
import ProductSplitHero from './hero/ProductSplitHero';

// Stub temporal — será reemplazado en Task 18
function ComboFlowStub({ onExit }: { onExit: () => void }) {
  return (
    <PageContainer>
      <AppHeader variant="wizard" onBack={onExit} />
      <main className="px-5 pt-6 pb-10 text-ink-muted">
        ComboFlow placeholder · Task 18 implementa
      </main>
    </PageContainer>
  );
}
```

Y usar `<ComboFlowStub>` en el render branch hasta Task 18.

- [ ] **Step 3: Borrar `HeroLanding.tsx`**

```bash
rm components/hero/HeroLanding.tsx
```

Verificar que no hay otros consumers:
```bash
grep -rn "HeroLanding" components/ app/ lib/
```

Expected: 0 matches después de borrar el file. Si hay referencias en RifasApp.tsx, reemplazar por ProductSplitHero / borrar.

- [ ] **Step 4: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Smoke local — abrir http://localhost:3000**

Verificar:
- Home muestra dos cards (rifa con precio + disponibles, combo con $15.000)
- Click en rifa → wizard rifa funciona como antes
- Click en combo → muestra placeholder (stub)
- Back arrow vuelve a home

- [ ] **Step 6: Commit**

```bash
git add components/hero/ProductSplitHero.tsx components/RifasApp.tsx
git rm components/hero/HeroLanding.tsx  # si quedó tracked
git commit -m "feat(combos): ProductSplitHero + RifasApp view state

Reemplaza HeroLanding por dos cards (Rifa / Combo) en home.
view state: 'home' | 'rifa' | 'combo'.
ComboFlow stub temporal — Task 18 implementa el wizard real.

Click rifa → wizard intacto Fase 5.B.
Click combo → placeholder.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: `<ComboRow>` + `<ComboCatalog>`

**Files:**
- Create: `components/combos/ComboRow.tsx`
- Create: `components/combos/ComboCatalog.tsx`

- [ ] **Step 1: Implement `<ComboRow>`**

```tsx
'use client';

import { memo } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Combo } from '../../lib/combos';

interface ComboRowProps {
  combo: Combo;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function ComboRow({ combo, quantity, onIncrement, onDecrement }: ComboRowProps) {
  const isActive = quantity > 0;

  return (
    <div className="rounded-xl border border-ink-faint bg-surface-raised p-3 flex items-center gap-3">
      <div className="text-3xl leading-none flex-shrink-0" aria-hidden>{combo.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink leading-tight">{combo.name}</div>
        <div className="text-xs text-ink-muted mt-0.5">{combo.description}</div>
        <div className="text-sm font-extrabold text-brand mt-1">
          ${combo.price.toLocaleString('es-AR')}
        </div>
      </div>
      <div
        className={`flex items-center gap-2 rounded-full p-0.5 px-1 border ${
          isActive ? 'border-brand' : 'border-ink-faint'
        }`}
        role="group"
        aria-label={`Cantidad de ${combo.name}`}
      >
        <button
          type="button"
          onClick={onDecrement}
          disabled={quantity === 0}
          aria-label={`Quitar uno de ${combo.name}`}
          className={`h-7 w-7 rounded-full text-base font-bold transition ${
            quantity === 0 ? 'text-ink-faint cursor-not-allowed' : 'text-brand'
          }`}
        >
          <Minus className="h-4 w-4 mx-auto" aria-hidden />
        </button>
        <span className={`text-sm font-extrabold min-w-[14px] text-center ${
          isActive ? 'text-ink' : 'text-ink-muted'
        }`}>{quantity}</span>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Agregar uno de ${combo.name}`}
          className="h-7 w-7 rounded-full bg-brand text-white text-base font-bold"
        >
          <Plus className="h-4 w-4 mx-auto" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default memo(ComboRow);
```

- [ ] **Step 2: Implement `<ComboCatalog>`**

```tsx
'use client';

import { useMemo } from 'react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import ComboRow from './ComboRow';
import { COMBOS, calculateTotal, type CartItem } from '../../lib/combos';

interface ComboCatalogProps {
  cart: Record<string, number>;  // comboId → quantity
  onChangeQuantity: (comboId: string, delta: number) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function ComboCatalog({ cart, onChangeQuantity, onContinue, onBack }: ComboCatalogProps) {
  const items: CartItem[] = useMemo(
    () => Object.entries(cart).map(([comboId, quantity]) => ({ comboId, quantity })),
    [cart]
  );

  const total = useMemo(() => calculateTotal(items), [items]);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const canContinue = totalCount > 0;

  return (
    <PageContainer>
      <AppHeader variant="wizard" onBack={onBack} title="Combos del evento" />
      <main className="px-5 pt-4 pb-32 flex flex-col gap-2.5">
        {COMBOS.map((combo) => (
          <ComboRow
            key={combo.id}
            combo={combo}
            quantity={cart[combo.id] ?? 0}
            onIncrement={() => onChangeQuantity(combo.id, +1)}
            onDecrement={() => onChangeQuantity(combo.id, -1)}
          />
        ))}
      </main>
      <StickyBottomBar>
        <div className="flex items-center justify-between w-full">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">
              Total · {totalCount} {totalCount === 1 ? 'combo' : 'combos'}
            </div>
            <div className="text-lg font-black text-ink">${total.toLocaleString('es-AR')}</div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className={`rounded-lg px-5 py-3 text-sm font-bold transition ${
              canContinue ? 'bg-brand text-white' : 'bg-ink-faint text-ink-muted cursor-not-allowed'
            }`}
          >
            Continuar →
          </button>
        </div>
      </StickyBottomBar>
    </PageContainer>
  );
}
```

- [ ] **Step 3: Lint + build + commit**

```bash
npm run lint && npm run build
git add components/combos/ComboRow.tsx components/combos/ComboCatalog.tsx
git commit -m "feat(combos): ComboRow (memo) + ComboCatalog con sticky cart bar

ComboRow: fila compacta con stepper +/-, memo para evitar
re-renders en cambios de cart.
ComboCatalog: 3 ComboRows iterando COMBOS, sticky bar con
total + CTA disabled si cart vacío.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: `<ComboBuyerForm>`

**Files:**
- Create: `components/combos/ComboBuyerForm.tsx`

- [ ] **Step 1: Implement reusing `<FormField>`**

```tsx
'use client';

import { useState } from 'react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import FormField from '../form/FormField';

export interface ComboBuyer {
  name: string;
  email: string;
  phone: string;
}

interface ComboBuyerFormProps {
  initial?: Partial<ComboBuyer>;
  onSubmit: (buyer: ComboBuyer) => void;
  onBack: () => void;
}

export default function ComboBuyerForm({ initial, onSubmit, onBack }: ComboBuyerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Nombre requerido';
    if (!email.trim()) next.email = 'Email requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Email inválido';
    if (!phone.trim()) next.phone = 'Teléfono requerido';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <PageContainer>
        <AppHeader variant="wizard" onBack={onBack} title="Tus datos" />
        <main className="px-5 pt-4 pb-32 flex flex-col gap-4">
          <FormField
            label="Nombre y apellido"
            value={name}
            onChange={setName}
            error={errors.name}
            autoComplete="name"
            required
          />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            error={errors.email}
            autoComplete="email"
            required
          />
          <FormField
            label="Teléfono"
            type="tel"
            value={phone}
            onChange={setPhone}
            error={errors.phone}
            autoComplete="tel"
            required
          />
          <p className="text-xs text-ink-muted mt-2">
            Te vamos a enviar el comprobante por email. El día del evento, retirá tu pedido con tu nombre y código.
          </p>
        </main>
        <StickyBottomBar>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand text-white py-3 text-sm font-bold"
          >
            Continuar →
          </button>
        </StickyBottomBar>
      </PageContainer>
    </form>
  );
}
```

NOTA: si la signature de `<FormField>` actual difiere (ej: `onChange` recibe un evento en vez de string), ajustar acorde. Read `components/form/FormField.tsx` antes de copiar este código tal cual.

- [ ] **Step 2: Lint + build + commit**

```bash
npm run lint && npm run build
git add components/combos/ComboBuyerForm.tsx
git commit -m "feat(combos): ComboBuyerForm con 3 campos (name + email + phone)

Reusa FormField de Fase 5.B. Sin bloque estudiante (combos no
son fundraising por curso). Validación inline con regex email.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: `<ComboReview>`

**Files:**
- Create: `components/combos/ComboReview.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import { COMBOS, type CartItem } from '../../lib/combos';
import type { ComboBuyer } from './ComboBuyerForm';

interface ComboReviewProps {
  cart: Record<string, number>;
  buyer: ComboBuyer;
  total: number;
  isLoading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ComboReview({ cart, buyer, total, isLoading, error, onConfirm, onBack }: ComboReviewProps) {
  const items: { combo: typeof COMBOS[number]; quantity: number }[] = [];
  for (const combo of COMBOS) {
    const q = cart[combo.id] ?? 0;
    if (q > 0) items.push({ combo, quantity: q });
  }

  return (
    <PageContainer>
      <AppHeader variant="wizard" onBack={onBack} title="Revisar pedido" />
      <main className="px-5 pt-4 pb-32 flex flex-col gap-4">
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted mb-2">Tu pedido</h2>
          <div className="rounded-xl border border-ink-faint bg-surface-raised divide-y divide-ink-faint">
            {items.map(({ combo, quantity }) => (
              <div key={combo.id} className="flex items-center gap-3 p-3">
                <div className="text-2xl" aria-hidden>{combo.emoji}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-ink">{combo.name}</div>
                  <div className="text-xs text-ink-muted">{quantity} × ${combo.price.toLocaleString('es-AR')}</div>
                </div>
                <div className="text-sm font-extrabold text-ink">
                  ${(quantity * combo.price).toLocaleString('es-AR')}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-surface-base">
              <div className="text-sm font-bold text-ink">Total</div>
              <div className="text-lg font-black text-brand">${total.toLocaleString('es-AR')}</div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted mb-2">Tus datos</h2>
          <div className="rounded-xl border border-ink-faint bg-surface-raised p-3 text-sm text-ink space-y-1">
            <div><span className="text-ink-muted">Nombre:</span> {buyer.name}</div>
            <div><span className="text-ink-muted">Email:</span> {buyer.email}</div>
            <div><span className="text-ink-muted">Teléfono:</span> {buyer.phone}</div>
          </div>
        </section>

        <p className="text-xs text-ink-muted leading-relaxed">
          Al confirmar te redirigimos a MercadoPago. Después del pago vuelvas a esta página y te mostramos tu código de retiro.
        </p>

        {error && (
          <div className="rounded-lg bg-state-error/10 border border-state-error/30 px-3 py-2 text-sm text-state-error" role="alert">
            {error}
          </div>
        )}
      </main>
      <StickyBottomBar>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`w-full rounded-lg py-3 text-sm font-bold transition ${
            isLoading ? 'bg-ink-faint text-ink-muted cursor-wait' : 'bg-mp-blue text-white'
          }`}
        >
          {isLoading ? 'Redirigiendo…' : 'Pagar con MercadoPago →'}
        </button>
      </StickyBottomBar>
    </PageContainer>
  );
}
```

NOTA: `bg-mp-blue` es el token Tailwind del color MercadoPago. Si no existe en `tailwind.config.js`, usar `bg-brand` o agregar el token. Verificar antes de pegar.

- [ ] **Step 2: Lint + build + commit**

```bash
npm run lint && npm run build
git add components/combos/ComboReview.tsx
git commit -m "feat(combos): ComboReview con breakdown items + total + buyer

Mismo patrón que PurchaseReview de rifa adaptado a combos:
breakdown por línea con qty × precio, total destacado,
sección buyer, CTA Pagar con MP con loading state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: `<ComboSuccessScreen>` + props productType en Failure/Pending

**Files:**
- Create: `components/status/ComboSuccessScreen.tsx`
- Modify: `components/status/FailureScreen.tsx` (+productType prop)
- Modify: `components/status/PendingScreen.tsx` (+productType prop)

- [ ] **Step 1: Implement `<ComboSuccessScreen>`**

```tsx
'use client';

import { CheckCircle2, MessageCircle } from 'lucide-react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import { COMBOS } from '../../lib/combos';

interface ComboSuccessScreenProps {
  orderCode?: string | null;
  cart?: Record<string, number>;
  onRestart: () => void;
}

export default function ComboSuccessScreen({ orderCode, cart, onRestart }: ComboSuccessScreenProps) {
  const items = cart
    ? COMBOS
        .map((c) => ({ combo: c, quantity: cart[c.id] ?? 0 }))
        .filter((it) => it.quantity > 0)
    : [];

  const shareWhatsApp = () => {
    if (!orderCode) return;
    const itemsText = items.map((it) => `${it.quantity}× ${it.combo.name}`).join(', ');
    const text = `Compré combos para el evento STA 2026! ${itemsText}. Código: ${orderCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <PageContainer>
      <AppHeader variant="hero" />
      <main className="px-5 pt-8 pb-10 flex flex-col items-center gap-5 text-center">
        <CheckCircle2 className="h-16 w-16 text-state-success" aria-hidden />
        <h1 className="text-2xl font-black text-ink tracking-tight">¡Pago aprobado!</h1>

        {orderCode ? (
          <div className="w-full">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">Tu código de retiro</div>
            <div className="text-3xl font-black text-brand letter-spacing-tight tracking-tight">{orderCode}</div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Revisá tu correo para ver el comprobante.</p>
        )}

        {items.length > 0 && (
          <div className="w-full rounded-xl border border-ink-faint bg-surface-raised p-3 text-left">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">Pedido</div>
            <ul className="text-sm text-ink space-y-1">
              {items.map(({ combo, quantity }) => (
                <li key={combo.id}>
                  <span className="font-bold">{quantity}×</span> {combo.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-ink-muted leading-relaxed">
          El día del evento, retirá tu pedido en el puesto de comida con tu nombre y este código.
        </p>

        <div className="w-full flex flex-col gap-2 mt-4">
          {orderCode && (
            <button
              type="button"
              onClick={shareWhatsApp}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-ink-faint bg-surface-raised text-ink py-3 text-sm font-bold"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Compartir por WhatsApp
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-lg bg-brand text-white py-3 text-sm font-bold"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    </PageContainer>
  );
}
```

- [ ] **Step 2: Modificar `<FailureScreen>` con `productType` prop**

Read el archivo actual y agregar prop opcional:

```tsx
interface FailureScreenProps {
  // ... existing props
  productType?: 'rifa' | 'combo';
}
```

Tweaks de copy según productType (ej: "Tu compra de la rifa no se procesó" vs "Tu compra de combos no se procesó"). Mantener layout idéntico.

- [ ] **Step 3: Modificar `<PendingScreen>` ídem**

- [ ] **Step 4: Lint + build + commit**

```bash
npm run lint && npm run build
git add components/status/
git commit -m "feat(combos): ComboSuccessScreen + productType prop en Failure/Pending

ComboSuccessScreen muestra COM-xxxx grande + breakdown items + share WA.
FailureScreen y PendingScreen ahora aceptan productType opcional para
tweaks de copy. Layout y a11y idénticos.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: `<ComboFlow>` orchestrator wires everything

**Files:**
- Create: `components/combos/ComboFlow.tsx`
- Modify: `components/RifasApp.tsx` (reemplazar ComboFlowStub por import real)

- [ ] **Step 1: Implement `<ComboFlow>`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import ComboCatalog from './ComboCatalog';
import ComboBuyerForm, { type ComboBuyer } from './ComboBuyerForm';
import ComboReview from './ComboReview';
import ComboSuccessScreen from '../status/ComboSuccessScreen';
import FailureScreen from '../status/FailureScreen';
import PendingScreen from '../status/PendingScreen';
import { calculateTotal, type CartItem } from '../../lib/combos';

type Step = 'catalog' | 'form' | 'review' | 'success' | 'failure' | 'pending';

interface ComboFlowProps {
  onExit: () => void;
  initialStep?: Step;
  initialOrderCode?: string | null;
}

export default function ComboFlow({ onExit, initialStep = 'catalog', initialOrderCode = null }: ComboFlowProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState<ComboBuyer | null>(null);
  const [comboPurchaseId, setComboPurchaseId] = useState<string | null>(initialOrderCode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeQuantity(comboId: string, delta: number) {
    setCart((prev) => {
      const current = prev[comboId] ?? 0;
      const next = Math.max(0, Math.min(50, current + delta));
      const updated = { ...prev };
      if (next === 0) delete updated[comboId];
      else updated[comboId] = next;
      return updated;
    });
  }

  const cartItems: CartItem[] = Object.entries(cart).map(([comboId, quantity]) => ({ comboId, quantity }));
  const total = calculateTotal(cartItems);

  async function handleConfirm() {
    if (!buyer) return;
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: create combo_purchase
      const purchaseRes = await fetch('/api/combo/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer, items: cartItems })
      });
      const purchaseData = await purchaseRes.json();
      if (!purchaseRes.ok || !purchaseData.success) {
        throw new Error(purchaseData.error ?? 'Error al crear compra');
      }
      const id = purchaseData.comboPurchaseId as string;
      setComboPurchaseId(id);

      // Step 2: create preference
      const prefRes = await fetch('/api/combo/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comboPurchaseId: id })
      });
      const prefData = await prefRes.json();
      if (!prefRes.ok || !prefData.success) {
        throw new Error(prefData.error ?? 'Error al crear preferencia');
      }

      // Step 3: redirect a MP
      window.location.href = prefData.initPoint;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
    }
  }

  function restart() {
    setCart({});
    setBuyer(null);
    setComboPurchaseId(null);
    setError(null);
    onExit();
  }

  if (step === 'success') {
    return <ComboSuccessScreen orderCode={comboPurchaseId} cart={cart} onRestart={restart} />;
  }
  if (step === 'failure') {
    return <FailureScreen productType="combo" onRetry={() => setStep('catalog')} onHome={restart} />;
  }
  if (step === 'pending') {
    return <PendingScreen productType="combo" onHome={restart} />;
  }

  if (step === 'catalog') {
    return (
      <ComboCatalog
        cart={cart}
        onChangeQuantity={changeQuantity}
        onContinue={() => {
          if (Object.keys(cart).length === 0) return;
          setStep('form');
        }}
        onBack={onExit}
      />
    );
  }

  if (step === 'form') {
    return (
      <ComboBuyerForm
        initial={buyer ?? undefined}
        onSubmit={(b) => {
          setBuyer(b);
          setStep('review');
        }}
        onBack={() => setStep('catalog')}
      />
    );
  }

  // step === 'review'
  if (!buyer) {
    setStep('form');
    return null;
  }
  return (
    <ComboReview
      cart={cart}
      buyer={buyer}
      total={total}
      isLoading={isLoading}
      error={error}
      onConfirm={handleConfirm}
      onBack={() => setStep('form')}
    />
  );
}
```

- [ ] **Step 2: Reemplazar el stub en `RifasApp.tsx`**

Borrar el `ComboFlowStub` definido en Task 13. Importar:

```tsx
import ComboFlow from './combos/ComboFlow';
```

Y usarlo donde estaba el stub. Además, manejar query params `?combo=success&order=COM-xxx` en el effect de mount (similar a fix I-1):

```tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const comboStatus = params.get('combo');
  const order = params.get('order');

  if (comboStatus && order) {
    setView('combo');
    // Pasar status inicial al ComboFlow
    setComboInitialStep(comboStatus as 'success' | 'failure' | 'pending');
    setComboInitialOrderCode(order);
    // Cleanup URL
    window.history.replaceState({}, '', '/');
  } else {
    // existing logic for ?payment=success&purchase=...
    // ... (rifa params)
  }
}, []);
```

Y en el render cuando view==='combo':

```tsx
return (
  <ComboFlow
    onExit={() => setView('home')}
    initialStep={comboInitialStep ?? 'catalog'}
    initialOrderCode={comboInitialOrderCode}
  />
);
```

- [ ] **Step 3: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Smoke local — flow completo**

Con dev server, verificar:
- Home → click combo card → ComboCatalog
- Agregar 2 chorizo + 1 empanada → "Total · 3 combos · $45.000"
- Continuar → ComboBuyerForm → llenar datos → Continuar
- ComboReview muestra breakdown correcto + buyer
- Click "Pagar con MP" → redirect a sandbox MP (init_point)
- En sandbox, completar pago de prueba
- Redirect a `/?combo=success&order=COM-xxx&payment_id=...`
- Frontend consume params → muestra ComboSuccessScreen con código

Si el redirect post-pago no muestra el success screen correcto, revisar el effect de mount.

- [ ] **Step 5: Commit**

```bash
git add components/combos/ComboFlow.tsx components/RifasApp.tsx
git commit -m "feat(combos): ComboFlow orchestrator wires catalog/form/review/status

State machine: catalog → form → review → MP redirect → status.
RifasApp consume query params ?combo=...&order=COM-xxx en mount,
limpia URL via replaceState (patrón fix I-1 Fase 5.B).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Cierre Fase 6.B · validación + commit final

- [ ] **Step 1: Lint + build verde**

```bash
npm run lint && npm run build
```

- [ ] **Step 2: Smoke local — flow completo end-to-end**

(idem Task 18 step 4 pero con compra real sandbox MP completada)

- [ ] **Step 3: Marcar Fase 6.B en ESTADO.md y commit**

```bash
# Cambiar [ ] 6.B → [x] 6.B
git add ESTADO.md
git commit -m "chore: Fase 6.B cerrada (UI combos completo)

ProductSplitHero + ComboFlow + 5 componentes combos + status screens.
Smoke local end-to-end verde con sandbox MP.

Próximo: Fase 6.C smoke E2E sandbox + 6.D deploy + compra real.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Fase 6.C · Sandbox MP smoke E2E

## Task 20: Sandbox MP smoke E2E completo

**Files:** ninguno (solo testing)

NOTA: requiere credenciales TEST en `.env.local` para sandbox MP. Si actualmente están las productivas, hay que cambiar temporalmente. Verificar con el usuario antes.

- [ ] **Step 1: Confirmar credenciales sandbox**

```bash
grep MERCADO_PAGO_ACCESS_TOKEN .env.local
```

Si empieza con `APP_USR-` son productivas. Para testing real con tarjetas TEST debe ser `TEST-...`. Pedir al usuario credenciales sandbox o saltar a producción real (Task 22).

- [ ] **Step 2: Smoke completo en sandbox**

(reemplazar credenciales en `.env.local` con TEST-..., reiniciar dev server)

- Home → click combo → catalog → agregar items → continuar
- Form → llenar datos → continuar
- Review → click "Pagar con MP"
- Sandbox MP: usar tarjeta de prueba aprobada (4509 9535 6623 3704, MASTERCARD APRO)
- Redirect a success
- Verificar SuccessScreen muestra COM-code + breakdown correcto

- [ ] **Step 3: Verificar BD post-pago**

Vía Turso MCP:
```sql
SELECT * FROM combo_purchases WHERE id = 'COM-xxx';
SELECT * FROM combo_purchase_items WHERE combo_purchase_id = 'COM-xxx';
SELECT * FROM event_logs WHERE purchase_id = 'COM-xxx' ORDER BY created_at;
```

Expected:
- combo_purchase con `payment_status='approved'`, `mercado_pago_payment_id` poblado
- 1+ rows en combo_purchase_items
- 2+ rows en event_logs (`COMBO_PURCHASE_CREATED` + `COMBO_PAYMENT_CONFIRMED`)

- [ ] **Step 4: Smoke flow rifa para confirmar NO regresión**

Volver a home → click rifa card → comprar 1 número con tarjeta TEST → verificar BD:
```sql
SELECT * FROM purchases ORDER BY created_at DESC LIMIT 1;
SELECT * FROM raffle_numbers WHERE status = 'sold';
```

Expected: rifa flow funciona idéntico a antes.

- [ ] **Step 5: Cleanup BD test**

```sql
DELETE FROM combo_purchase_items WHERE combo_purchase_id LIKE 'COM-%';
DELETE FROM event_logs WHERE event_type LIKE 'COMBO_%';
DELETE FROM combo_purchases;
-- y limpiar el purchase test del rifa similar al cleanup post-Romi
```

- [ ] **Step 6: Restaurar credenciales productivas en `.env.local`**

- [ ] **Step 7: Commit smoke completion**

```bash
git commit --allow-empty -m "chore: Fase 6.C cerrada (sandbox MP smoke E2E verde)

Combos approved en sandbox con BD coherente. Rifa flow sin regresión.
Webhook dispatch valida ambos prefijos PUR-/COM-.

Próximo: Fase 6.D deploy a Cloud Run + compra real \$15.000.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Fase 6.D · Deploy + compra real

## Task 21: Pre-deploy + merge feature branch + deploy

**Files:** ninguno (deploy)

- [ ] **Step 1: Pre-deploy checklist**

- [ ] Lint + build verde en feature branch
- [ ] Tests unitarios verde
- [ ] Capturar revision actual de Cloud Run para rollback:

```bash
gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format='value(status.latestReadyRevisionName)'
```

Anotar el resultado (probablemente `sistema-ventas-rifas-00013-529`). Es la revision a la que rolleamos back si algo se rompe.

- [ ] **Step 2: Merge feature branch a main desde el repo principal**

```bash
# Volver al repo principal (no el worktree)
cd ../..
git checkout main
git merge --no-ff feature/combos-evento -m "$(cat <<'EOF'
merge: Fase 6 combos del evento → main

Sumar venta online vía MP de 3 combos (\$15.000 c/u, sandwich
chorizo / sandwich carne / 3 empanadas) integrada al sitio
actual con UI split entry.

22 commits en feature/combos-evento:
- 6.A: schema + service + 4 APIs + webhook dispatch
- 6.B: ProductSplitHero + ComboFlow + 5 componentes
- 6.C: smoke sandbox MP verde, rifa sin regresión

Plan: docs/superpowers/plans/2026-05-05-combos-evento-fase-6.md
Spec: docs/superpowers/specs/2026-05-05-combos-evento-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 3: Cleanup worktree + branch**

```bash
git worktree remove .worktrees/fase-6
git branch -d feature/combos-evento
git push origin --delete feature/combos-evento
```

- [ ] **Step 4: Deploy a Cloud Run**

```bash
./scripts/deploy.sh
```

Expected: nueva revision (probablemente `00014-XXX`) sirviendo 100% del tráfico. URL pública sigue siendo `https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app`.

- [ ] **Step 5: Smoke prod básico**

```bash
curl -sS -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/
curl -sS https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/raffle/config
```

Expected: 200 OK en ambos. La home en browser muestra ProductSplitHero con dos cards.

- [ ] **Step 6: Confirmar CRON_SECRET y dispatch en revision nueva**

```bash
gcloud run services describe sistema-ventas-rifas --region=us-east1 \
  --project=sistema-ventas-rifas-prod \
  --format='value(spec.template.spec.containers[0].env[].name)' | tr ';' '\n'
```

Expected: incluye CRON_SECRET (preservado por el fix de deploy.sh anterior).

- [ ] **Step 7: Si algo falla, rollback inmediato**

```bash
gcloud run services update-traffic sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --to-revisions=<REVISION_ANTERIOR>=100
```

(Reemplazar `<REVISION_ANTERIOR>` con el valor del Step 1.)

---

## Task 22: Compra real $15.000 + cleanup

**Files:** ninguno (validation)

- [ ] **Step 1: Compra real combos en producción**

URL: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app

Pedir a un tercero (no el dueño del MP collector — recordar lección seller=buyer) que haga una compra real de combos por ~$15.000-30.000. Idealmente 1 sola unidad de un combo para mínimo gasto, o pedirle a Romi que coordine con alguien.

Verificar:
- Flow completo OK
- MP comprobante llega al email del comprador con `description` mostrando `COM-xxxx`
- SuccessScreen muestra el código
- BD: `SELECT * FROM combo_purchases WHERE payment_status='approved' ORDER BY created_at DESC LIMIT 1`

- [ ] **Step 2: Compra real número de rifa para confirmar NO regresión**

(Romi o tercero compra 1 número $1.000)

Verificar:
- Flow rifa funciona idéntico a antes
- BD: nueva row en `purchases` con `payment_status='approved'`, número correspondiente en `raffle_numbers` con `status='sold'`

- [ ] **Step 3: (Opcional) Refund/cleanup si fueron de prueba**

Si las compras reales fueron de prueba y el comprador acepta, refundear vía MP dashboard y limpiar BD. Si son ventas legítimas (Romi cobra para el evento), dejar.

- [ ] **Step 4: Marcar Fase 6 completa en ESTADO.md y commit final**

```bash
# Cambiar todas las [ ] de Fase 6 → [x]
git add ESTADO.md
git commit -m "chore: Fase 6 cerrada — combos del evento en producción

Compra real \$15.000 confirmada end-to-end. BD coherente.
Rifa flow sin regresión.

Producción:
- Revision: <NUEVA_REVISION>
- URL: https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 5: Anuncio del lanzamiento de combos al colegio**

Coordinar con Romi el momento del anuncio. Antes de eso, monitor activo:

```bash
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod --limit=50
```

---

## Self-Review

**Spec coverage**: cada sección/requisito del spec aparece en al menos un task.

| Spec section | Task(s) que lo implementa |
|---|---|
| 2. Decisiones (10 ítems) | Cubiertos a lo largo de tasks 2-22 |
| 3. User flow / IA | Tasks 13, 18 (flow combos completo) |
| 4.1 Catálogo hardcoded | Task 2 |
| 4.2 Tablas combo_purchases + items | Tasks 3, 4 |
| 4.3 event_logs reuse | Task 3 (no se modifica) + Task 5 (escribe COMBO_*) |
| 4.5 Migración Drizzle | Tasks 3, 4 |
| 5.1 6 endpoints API combo | Tasks 7-10 |
| 5.2 Webhook dispatch | Task 11 |
| 5.3 MP preference structure | Task 6 |
| 5.4 Service layer | Task 5 |
| 6 Estructura archivos | Tasks 13-18 |
| 7 Edge cases | Cubiertos en tasks 5, 7, 18 |
| 8 Test strategy | Tasks 2, 5, 12, 20 |
| 10 Plan de rollback | Task 21 step 1 + 7 |
| 11 Out of scope | NO se implementa (correcto) |

**Type consistency**: nombres usados consistentemente (`comboPurchaseId`, `cart`, `items`, `buyer`, `total`, `orderCode`). Service methods (`createComboPurchase`, `confirmComboPayment`, `cancelComboPayment`, `getComboPurchase`, `setMercadoPagoPreferenceId`) referenciados con la misma firma en tasks 5, 7, 8, 9, 11.

**Placeholder scan**: no hay "TBD"/"TODO" sin contenido; cada step tiene código completo o comando exacto. Las funciones de UI (`ComboFlow`, `ComboCatalog`, etc.) tienen JSX completo. Algunos tasks de modificación de archivos existentes ("Read antes de copiar") indican explícitamente qué leer primero porque no podemos copiar sin verificar la signature actual — esto NO es un placeholder, es una instrucción concreta.

**Scope check**: 22 tasks distribuidos en 4 sub-fases coherentes. Cada sub-fase produce software funcional y testable independientemente. Dentro del rango de tamaño de Fase 5.B (que tenía 13 tasks). Apropiado para single plan + execution.
