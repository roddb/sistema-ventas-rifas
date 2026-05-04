# Fix BUG-008 — Webhook MercadoPago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver el conjunto encadenado de 6 sub-bugs (008 base + 008-A a 008-F) en el handler webhook MercadoPago, dejando la verificación HMAC alineada con la spec oficial de MP, sin bypasses, idempotente, y con política de retries correcta para Fase 4 (lanzamiento rifa 2026).

**Architecture:**
1. Extraer `verifyWebhookSignature` a `lib/webhook-verification.ts` para permitir testing aislado y reuso.
2. Reescribir el manifest HMAC al formato oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
3. Reforzar el handler para rechazar todos los caminos de bypass identificados (sin x-signature, sin x-request-id, sin data.id, excepción en timingSafeEqual).
4. Agregar idempotencia en `confirmPayment` (return early si `paymentStatus === 'approved'`).
5. Cambiar política del catch externo: devolver 5xx en errores transitorios para que MP reintente.

**Tech Stack:** Next.js 14.2.35 App Router, Node 20 (built-in `node --test` para tests unitarios — sin deps nuevas), TypeScript strict, Drizzle ORM 0.32.2, mercadopago SDK 2.0.15, crypto (Node built-in).

**Diagnóstico asociado:** ver salida del agent `diagnosis-specialist` del 2026-05-02 (resumen en BUGS.md BUG-008).

---

## File Structure

### Archivos NUEVOS

| Path | Responsabilidad |
|---|---|
| `lib/webhook-verification.ts` | Función pura `verifyMercadoPagoWebhookSignature` con manifest HMAC correcto, parseo robusto del header `x-signature` por nombre, validación de timestamp para mitigar replay attacks. ~80 líneas. |
| `tests/webhook-verification.test.mjs` | 12 tests unitarios (Node `node --test` built-in, sin deps): cubre manifest correcto, headers válidos/inválidos, timestamp viejo (replay), buffers desigualados, missing fields. |
| `tests/run-tests.sh` | Script wrapper para correr tests fácil. |

### Archivos MODIFICADOS

| Path | Cambio |
|---|---|
| `app/api/webhooks/mercadopago/route.ts` | Reemplaza `verifyWebhookSignature` interna por import de la nueva función. Reescribe handler POST para cerrar bypasses (todos los caminos de fallo → 401 explícito, no return false silencioso). Cambia política del catch para 5xx transitorios. |
| `lib/services/raffleService.ts` (función `confirmPayment`, líneas 347-384) | Agrega chequeo de idempotencia: si `purchase.paymentStatus === 'approved'`, return early con log. |
| `BUGS.md` (BUG-008) | Actualizar con causa raíz expandida (6 sub-bugs identificados) y marcar como RESUELTO post-fix. |
| `LEARNINGS.md` | Agregar 2 aprendizajes: formato correcto del manifest HMAC + decisión de devolver 5xx en errores transitorios para habilitar retries de MP. |
| `MEMORIA.md` | Nota sobre que el bug pre-existía desde 2025-09-11 (commit `437776e4`) y la rifa 2025 corrió con él. |
| `ESTADO.md` | Marcar la nueva tarea de fix como completada. Agregar bitácora 2026-05-02 segunda entrada. |
| `package.json` | Agregar script `test`: `node --test tests/*.test.mjs`. |

### Archivos NO TOCADOS

`lib/mercadopago.ts`, `lib/db/schema.ts`, `app/api/payment/*`, `app/api/preference/*`, componentes UI. El bug es solo del handler webhook + idempotencia downstream.

---

## Task 1: Crear módulo de verificación HMAC con tests TDD

**Files:**
- Create: `lib/webhook-verification.ts`
- Create: `tests/webhook-verification.test.mjs`
- Create: `tests/run-tests.sh`
- Modify: `package.json` (agregar script `test`)

### Contexto técnico

El manifest oficial de MercadoPago para verificar webhooks IPN es (según `.claude/agents/payment-flow-debugger.md:71-74` y la doc oficial):
```
id:<data.id>;request-id:<x-request-id>;ts:<ts>;
```
Con separador `;` (no `.`) y trailing `;`.

El header `x-signature` tiene formato:
```
ts=1234567890,v1=abc123def456...
```
Pero el orden de los campos NO está garantizado — debe parsearse por nombre.

- [ ] **Step 1: Crear `tests/webhook-verification.test.mjs` con 12 tests que fallan**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyMercadoPagoWebhookSignature, MAX_TIMESTAMP_AGE_SECONDS } from '../lib/webhook-verification.ts';

const SECRET = 'test-webhook-secret-1234567890';
const DATA_ID = '12345678901';
const REQUEST_ID = 'abc-def-ghi-jkl';

// Helper: genera firma válida para un manifest
function signManifest(secret, dataId, requestId, ts) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex');
}

function buildHeader(ts, v1) {
  return `ts=${ts},v1=${v1}`;
}

test('valid signature returns true', () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const v1 = signManifest(SECRET, DATA_ID, REQUEST_ID, ts);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(ts, v1),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, true);
});

test('null signatureHeader returns false', () => {
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: null,
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('null requestId returns false', () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const v1 = signManifest(SECRET, DATA_ID, 'whatever', ts);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(ts, v1),
    requestId: null,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('null dataId returns false', () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const v1 = signManifest(SECRET, 'whatever', REQUEST_ID, ts);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(ts, v1),
    requestId: REQUEST_ID,
    dataId: null,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('header in reverse order (v1 first, ts second) still validates', () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const v1 = signManifest(SECRET, DATA_ID, REQUEST_ID, ts);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: `v1=${v1},ts=${ts}`,
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, true);
});

test('header with extra fields (v2=...) still validates v1', () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const v1 = signManifest(SECRET, DATA_ID, REQUEST_ID, ts);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: `ts=${ts},v1=${v1},v2=futureversion`,
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, true);
});

test('header without ts field returns false', () => {
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: 'v1=abc123',
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('header without v1 field returns false', () => {
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: 'ts=1234567890',
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('mismatched signature returns false (wrong secret)', () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const v1 = signManifest('wrong-secret', DATA_ID, REQUEST_ID, ts);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(ts, v1),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('replay attack: timestamp older than MAX_TIMESTAMP_AGE_SECONDS returns false', () => {
  const oldTs = (Math.floor(Date.now() / 1000) - MAX_TIMESTAMP_AGE_SECONDS - 60).toString();
  const v1 = signManifest(SECRET, DATA_ID, REQUEST_ID, oldTs);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(oldTs, v1),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('future timestamp beyond tolerance returns false', () => {
  const futureTs = (Math.floor(Date.now() / 1000) + MAX_TIMESTAMP_AGE_SECONDS + 60).toString();
  const v1 = signManifest(SECRET, DATA_ID, REQUEST_ID, futureTs);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(futureTs, v1),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('non-numeric timestamp returns false (no exception)', () => {
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: 'ts=NOT_A_NUMBER,v1=deadbeef',
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});

test('hex hash with different length than expected returns false (no exception)', () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  // hash de longitud incorrecta (4 chars vs 64 esperados de sha256)
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(ts, 'abcd'),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});
```

- [ ] **Step 2: Crear el script `tests/run-tests.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
# Corre tests unitarios .mjs con node:test built-in.
# Necesita Node 20+ (que ya estamos pinned via .nvmrc / Dockerfile).
node --test --experimental-strip-types tests/*.test.mjs
```

Hacerlo ejecutable:
```bash
chmod +x tests/run-tests.sh
```

> **Nota técnica**: `--experimental-strip-types` permite que `node --test` importe archivos `.ts` directamente sin compilación previa (Node 20.6+). Si el flag falla en la versión local, alternativa: cambiar el import del test de `../lib/webhook-verification.ts` a `../lib/webhook-verification.mjs` y crear el módulo en .mjs en lugar de .ts.

- [ ] **Step 3: Agregar script `test` a `package.json`**

Editar `package.json`, en la sección `"scripts"`, agregar:
```json
"test": "./tests/run-tests.sh"
```

Después de la edición, la sección scripts queda:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "./tests/run-tests.sh",
  "db:generate": "drizzle-kit generate:sqlite",
  "db:migrate": "drizzle-kit push:sqlite",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 4: Correr tests para verificar que TODOS fallan**

```bash
npm run test
```
Resultado esperado: errores de import porque `lib/webhook-verification.ts` aún no existe. **Esto valida que estamos en TDD: tests primero, código después.**

- [ ] **Step 5: Crear `lib/webhook-verification.ts` con la implementación correcta**

```typescript
import crypto from 'crypto';

/**
 * Tolerancia máxima entre el timestamp del webhook y el momento actual.
 * 600 segundos (10 min) cubre el retry policy de MercadoPago (3 intentos en ~22 min)
 * y deja margen para clock skew, pero rechaza replay attacks de webhooks viejos.
 */
export const MAX_TIMESTAMP_AGE_SECONDS = 600;

interface VerifyParams {
  /** Valor literal del header `x-signature` (puede ser null si no vino). */
  signatureHeader: string | null;
  /** Valor del header `x-request-id`. Es parte del manifest. */
  requestId: string | null;
  /** El `data.id` del body del webhook. */
  dataId: string | null;
  /** El secret configurado (`MERCADO_PAGO_WEBHOOK_SECRET`). */
  secret: string;
}

/**
 * Verifica la firma HMAC-SHA256 de un webhook IPN de MercadoPago.
 *
 * Manifest oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Doc: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 *
 * Devuelve `true` solo si:
 * - Todos los inputs requeridos están presentes (no null/empty).
 * - El header `x-signature` contiene `ts` y `v1`.
 * - El timestamp es válido y reciente (<= MAX_TIMESTAMP_AGE_SECONDS).
 * - El HMAC del manifest con el secret matchea el `v1`.
 *
 * En cualquier otro caso (incluyendo errores parsing), devuelve `false` sin lanzar.
 */
export function verifyMercadoPagoWebhookSignature(params: VerifyParams): boolean {
  const { signatureHeader, requestId, dataId, secret } = params;

  if (!signatureHeader || !requestId || !dataId || !secret) {
    return false;
  }

  // Parsear el header por NOMBRE (no por posición) — soporta orden arbitrario y campos extra.
  const fields: Record<string, string> = {};
  for (const part of signatureHeader.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key && value) fields[key] = value;
  }

  const ts = fields['ts'];
  const v1 = fields['v1'];
  if (!ts || !v1) return false;

  // Validar timestamp (mitigación de replay attacks).
  const tsNumeric = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsNumeric)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNumeric) > MAX_TIMESTAMP_AGE_SECONDS) {
    return false;
  }

  // Construir el manifest oficial.
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  // Calcular HMAC esperado.
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  // Comparación constant-time. timingSafeEqual lanza si las longitudes difieren,
  // así que validamos antes para devolver false sin excepción.
  if (v1.length !== expectedHash.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(v1, 'utf8'),
      Buffer.from(expectedHash, 'utf8')
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Correr tests para verificar que pasan los 13**

```bash
npm run test
```
Resultado esperado: `# pass 13`, `# fail 0`. Si alguno falla, revisar y corregir el test o el código (manteniendo el spec del manifest oficial).

- [ ] **Step 7: Verificar que `npm run lint` y `npm run build` siguen verdes**

```bash
npm run lint
npm run build
```
Resultado esperado: ambos pasan sin errores nuevos. Las 3 warnings pre-existentes de `react-hooks/exhaustive-deps` son aceptables.

- [ ] **Step 8: Commit**

```bash
git add lib/webhook-verification.ts tests/webhook-verification.test.mjs tests/run-tests.sh package.json
git commit -m "feat(webhook): módulo verifyMercadoPagoWebhookSignature con tests TDD

- Función pura aislada en lib/webhook-verification.ts con manifest HMAC
  oficial de MP: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
- Parseo del header x-signature por NOMBRE (no posición) — soporta orden
  arbitrario y campos futuros (v2=, etc)
- Validación de timestamp (MAX_TIMESTAMP_AGE_SECONDS=600s) para mitigar
  replay attacks
- Manejo defensivo: longitudes desigualadas no lanzan, devuelven false
- 13 tests unitarios con node:test built-in (sin deps nuevas)
- Script npm run test agregado

Refs: BUG-008-A diagnóstico 2026-05-02 (manifest mal construido)."
```

---

## Task 2: Reforzar handler webhook — cerrar todos los bypasses

**Files:**
- Modify: `app/api/webhooks/mercadopago/route.ts`

### Cambios a aplicar

1. Reemplazar la `verifyWebhookSignature` interna por import del módulo nuevo.
2. Cerrar bypass por header faltante (sin `x-signature` o sin `x-request-id`) → 401.
3. Cerrar bypass por `body.data?.id` ausente → 401.
4. Hacer la verificación obligatoria si `MERCADO_PAGO_WEBHOOK_SECRET` está configurado (no condicional).
5. Descomentar el `return 401` en firma inválida.
6. Cambiar el catch externo para devolver 5xx en errores transitorios (BD, MP API), 200 solo en éxito explícito, 4xx en validación.

- [ ] **Step 1: Reemplazar todo el contenido de `app/api/webhooks/mercadopago/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { RaffleService } from '@/lib/services/raffleService';
import { verifyMercadoPagoWebhookSignature } from '@/lib/webhook-verification';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  console.log('=== MercadoPago Webhook Received ===');

  // 1. Parse body. Si no es JSON válido, 400.
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    console.error('Webhook body is not valid JSON:', err);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log('Webhook body:', JSON.stringify(body, null, 2));

  // 2. Headers.
  const headersList = headers();
  const signature = headersList.get('x-signature');
  const requestId = headersList.get('x-request-id');

  // 3. Validar campos requeridos del body.
  const dataId = body?.data?.id != null ? String(body.data.id) : null;
  if (!dataId) {
    console.error('Webhook rejected: missing body.data.id');
    return NextResponse.json({ error: 'Missing data.id' }, { status: 400 });
  }

  // 4. Verificar firma HMAC. Es obligatoria si el secret está configurado.
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('CRITICAL: MERCADO_PAGO_WEBHOOK_SECRET not configured. Rejecting webhook.');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const isValid = verifyMercadoPagoWebhookSignature({
    signatureHeader: signature,
    requestId,
    dataId,
    secret: webhookSecret,
  });

  if (!isValid) {
    console.error('Invalid webhook signature — request rejected', {
      hasSignature: !!signature,
      hasRequestId: !!requestId,
      dataId,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  console.log('Webhook signature verified successfully');

  // 5. Procesar según el tipo de notificación.
  const { type, action, data } = body;
  console.log(`Processing webhook: type=${type}, action=${action}, id=${data?.id}`);

  try {
    switch (type) {
      case 'payment':
        await handlePaymentNotification(data.id, action);
        break;

      case 'merchant_order':
        console.log('Merchant order notification received (not processed yet)');
        break;

      case 'plan':
      case 'subscription':
        console.log('Subscription notification received (not applicable)');
        break;

      default:
        console.log(`Unknown notification type: ${type}`);
    }

    return NextResponse.json(
      {
        received: true,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // Error transitorio (BD, MP API, network). Devolver 5xx para que MP reintente
    // con su retry policy (3 intentos en ~22 min). NO devolver 200 — eso le dice
    // a MP "ya procesado correctamente" y desperdicia la red de seguridad.
    console.error('Error processing webhook (returning 503 for MP retry):', error);
    return NextResponse.json(
      {
        error: 'Transient processing error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

// Handler para notificaciones de pago
async function handlePaymentNotification(paymentId: string, action?: string) {
  console.log(`Handling payment notification: ${paymentId}, action: ${action}`);

  const { getPaymentInfo } = await import('@/lib/mercadopago');

  // 1. Obtener detalles del pago desde la API de MercadoPago
  const paymentInfo = await getPaymentInfo(paymentId);
  console.log('Payment details:', paymentInfo);

  // 2. Verificar el estado del pago
  const purchaseId = paymentInfo.externalReference;
  if (!purchaseId) {
    console.error('No external reference (purchaseId) in payment');
    return;
  }

  // 3. Verificar que los números siguen reservados antes de confirmar
  if (paymentInfo.status === 'approved') {
    console.log(`Payment approved! Verifying purchase ${purchaseId} before confirming...`);

    const { db, schema } = await import('@/lib/db');
    const { eq } = await import('drizzle-orm');

    const [purchase] = await db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      console.error(`Purchase ${purchaseId} not found!`);
      return;
    }

    const reservedNumbers = await db
      .select()
      .from(schema.raffleNumbers)
      .where(eq(schema.raffleNumbers.purchaseId, purchaseId));

    if (reservedNumbers.length !== purchase.numbersCount) {
      console.error(
        `Mismatch in reserved numbers! Expected ${purchase.numbersCount}, found ${reservedNumbers.length}`
      );
      console.log('Numbers may have been released due to timeout. Manual intervention required.');
      return;
    }

    await RaffleService.confirmPayment(purchaseId, {
      paymentMethod: paymentInfo.paymentMethod?.id || 'mercadopago',
      mercadoPagoPaymentId: paymentId,
    });

    console.log(`Purchase ${purchaseId} confirmed successfully`);
  } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
    console.log(`Payment ${paymentInfo.status}. Cancelling purchase ${purchaseId}`);
    await RaffleService.cancelPayment(purchaseId);
  } else {
    console.log(`Payment status: ${paymentInfo.status} - No action taken`);
  }
}

// Endpoint GET para verificación de MercadoPago
export async function GET(_request: NextRequest) {
  console.log('Webhook GET request received - returning status');

  return NextResponse.json(
    {
      status: 'ready',
      endpoint: '/api/webhooks/mercadopago',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
```

- [ ] **Step 2: Verificar que `npm run lint` pasa**

```bash
npm run lint
```
Resultado esperado: 0 errores nuevos. Las 3 warnings pre-existentes son aceptables.

- [ ] **Step 3: Verificar que `npm run build` pasa**

```bash
rm -rf .next
npm run build
test -f .next/standalone/server.js && echo "OK build OK"
```
Resultado esperado: build exitoso.

- [ ] **Step 4: Verificar que tests siguen pasando**

```bash
npm run test
```
Resultado esperado: 13 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/mercadopago/route.ts
git commit -m "fix(webhook): restaurar verificación HMAC obligatoria + cerrar bypasses

Fix de BUG-008 base + 008-D + 008-F (resto en commits siguientes):

- Importa verifyMercadoPagoWebhookSignature desde lib/webhook-verification.ts
- 401 si firma inválida (return descomentado, era 'temporal para testing' desde 2025-09-11)
- 401 si MERCADO_PAGO_WEBHOOK_SECRET no configurado (era warning silencioso)
- 400 si body no es JSON o body.data.id ausente (cerraba bypass por payload vacío)
- 503 (no 200) en errores transitorios — habilita retry policy de MP (3 intentos
  en ~22 min). El comentario anterior 'devolver 200 para evitar reintentos' era
  anti-patrón: descartaba la red de seguridad ante fallas transitorias de BD/MP API.
- Removido el if (webhookSecret && body.data?.id) que volvía la verificación
  condicional — ahora es obligatoria.

Refs: BUG-008, BUG-008-D, BUG-008-F."
```

---

## Task 3: Idempotencia en `confirmPayment`

**Files:**
- Modify: `lib/services/raffleService.ts` (función `confirmPayment`, líneas 347-384)

### Contexto

MP puede reenviar el mismo webhook múltiples veces (3 retries en ~22 min según política IPN). Sin idempotencia, cada retry de un payment ya confirmado:
- Re-ejecuta `UPDATE purchases SET paymentStatus='approved'` (no daña pero es ruidoso).
- Re-ejecuta `UPDATE raffle_numbers SET status='sold', soldAt=NOW()` — **sobreescribe `soldAt`** con cada retry, perdiendo el timestamp original.
- **Inserta otro `eventLogs` con eventType `PAYMENT_CONFIRMED`** — duplicación de audit log.

Fix: leer el `paymentStatus` del purchase ANTES de updatear. Si ya es `'approved'`, return early con log "already processed" sin tocar nada.

- [ ] **Step 1: Modificar `lib/services/raffleService.ts` — función `confirmPayment`**

Reemplazar las líneas 346-384 (función completa) por:

```typescript
  // Confirmar pago y marcar números como vendidos.
  // Idempotente: si la compra ya fue confirmada antes, no re-ejecuta updates.
  static async confirmPayment(purchaseId: string, paymentData: {
    mercadoPagoPaymentId?: string;
    paymentMethod?: string;
  }) {
    if (!this.isDbAvailable()) {
      return true;
    }

    // Idempotencia: chequear si ya fue confirmado.
    const [existing] = await db
      .select({ paymentStatus: purchases.paymentStatus })
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    if (!existing) {
      console.error(`confirmPayment: purchase ${purchaseId} not found`);
      throw new Error(`Purchase ${purchaseId} not found`);
    }

    if (existing.paymentStatus === 'approved') {
      console.log(`confirmPayment: purchase ${purchaseId} already approved, skipping (idempotent retry)`);
      return true;
    }

    // Actualizar estado de la compra
    await db
      .update(purchases)
      .set({
        paymentStatus: 'approved',
        mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId,
        paymentMethod: paymentData.paymentMethod,
        updatedAt: new Date()
      })
      .where(eq(purchases.id, purchaseId));

    // Marcar números como vendidos
    await db
      .update(raffleNumbers)
      .set({
        status: 'sold',
        soldAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(raffleNumbers.purchaseId, purchaseId));

    // Log del evento (solo en confirmación nueva, no en retries)
    await db.insert(eventLogs).values({
      eventType: 'PAYMENT_CONFIRMED',
      purchaseId,
      data: JSON.stringify(paymentData)
    });

    return true;
  }
```

- [ ] **Step 2: Verificar TypeScript strict pasa**

```bash
npm run build
```
Resultado esperado: build OK. La query `select({ paymentStatus: purchases.paymentStatus })` es Drizzle-idiomática y respeta el tipo strict.

- [ ] **Step 3: Verificar tests siguen pasando**

```bash
npm run test
```
Resultado esperado: 13 tests pasan (tests son del módulo verificación, no de raffleService — pero confirma que no rompimos imports).

- [ ] **Step 4: Validar que la lógica de idempotencia es correcta — leer manualmente el flujo**

Caminos a verificar mentalmente:
- Llamada 1 (firma válida, purchase pending): query devuelve `pending`, ejecuta updates + insert log. ✅
- Llamada 2 sobre el mismo purchase (retry de MP, firma válida): query devuelve `approved`, return early sin updates. ✅
- Llamada 1 (purchase no existe): throw `Purchase not found`. El handler superior lo captura y devuelve 503 (Task 2 Step 1). ✅
- Concurrencia: dos retries de MP llegan al mismo tiempo. Drizzle no tiene transaction-level lock acá; ambos podrían leer `pending` antes de que el otro update. Resultado: dos UPDATEs (idempotentes) + dos inserts en `eventLogs` (duplicado). **Esto es aceptable porque:**
  - Los UPDATEs son idempotentes (mismos valores).
  - El duplicado en eventLogs es un edge case raro y no afecta integridad financiera.
  - Locking optimista vía `WHERE paymentStatus = 'pending'` agregaría complejidad sin valor real.
- Si el negocio cambia y se necesita un único log per confirmación: cambiar el INSERT a `INSERT ... ON CONFLICT DO NOTHING` (requiere unique index en `eventLogs(purchaseId, eventType)`). **Fuera de scope de este fix**.

- [ ] **Step 5: Commit**

```bash
git add lib/services/raffleService.ts
git commit -m "fix(payment): idempotencia en RaffleService.confirmPayment

Fix de BUG-008-E:

MP puede reenviar el mismo webhook múltiples veces (3 retries en ~22 min).
Sin idempotencia, cada retry sobreescribía soldAt y duplicaba eventLogs.

Cambio: leer purchases.paymentStatus antes de updatear. Si ya es 'approved',
return early con log 'already processed'. Throw si purchase no existe.

Concurrencia: dos retries simultáneos pueden re-ejecutar UPDATEs (idempotentes,
mismos valores) + insertar 2 eventLogs. Aceptable; un unique index en
(purchaseId, eventType) sería mejora futura — no scope de este fix.

Refs: BUG-008-E, payment-flow-debugger.md:84-93."
```

---

## Task 4: Verificar coincidencia del `MERCADO_PAGO_WEBHOOK_SECRET` MP↔GCP

**Files:** ninguno modificado en el repo. Solo gcloud + comparación visual.

### Contexto

Si los secrets difieren, **el fix en código no alcanza** — las firmas legítimas seguirán siendo rechazadas. Hay que asegurar que el valor en Secret Manager (GCP) es el mismo que MP usa para firmar webhooks.

> ⚠️ **Atención de seguridad**: este paso requiere ver el valor del secret en local. Limpiar history shell después.

- [ ] **Step 1: Recuperar el secret de GCP a una variable shell (NO imprimir)**

```bash
GCP_SECRET=$(gcloud secrets versions access latest --secret=mp-webhook-secret --project=sistema-ventas-rifas-prod)
echo "GCP secret length: ${#GCP_SECRET}"
echo "GCP secret prefix: ${GCP_SECRET:0:8}..."
```
Resultado esperado: longitud y prefijo de 8 chars (sin imprimir el valor completo).

- [ ] **Step 2: Mostrar el secret de MP dashboard al usuario**

> Esta es una acción manual del usuario. Pedirle:
> 1. Ir a https://www.mercadopago.com.ar/developers/panel/app/3796491518010506/webhooks
> 2. En el campo "Clave secreta" hacer click en el ícono de "ver" (🔍) o "copiar".
> 3. Anotar el prefijo de 8 chars y la longitud total.

- [ ] **Step 3: Comparar prefijo y longitud**

```bash
echo "MP secret prefix: <pegar 8 chars del usuario>"
echo "GCP secret prefix: ${GCP_SECRET:0:8}..."
```

- Si **coinciden** prefijo y longitud → 99% probable que sean el mismo. Continuar a Step 5.
- Si **NO coinciden** → updating el secret en GCP (Step 4).

- [ ] **Step 4: (CONDICIONAL — solo si difieren) Actualizar el secret en GCP**

```bash
# Pedir al usuario que pegue el secret completo de MP dashboard
read -s -p "Pegá el MERCADO_PAGO_WEBHOOK_SECRET de MP dashboard (entrada oculta): " MP_SECRET
echo ""
echo -n "$MP_SECRET" | gcloud secrets versions add mp-webhook-secret \
  --data-file=- \
  --project=sistema-ventas-rifas-prod

# Forzar redeploy para que tome la nueva versión
./scripts/deploy.sh

# Limpiar variable
unset MP_SECRET
```

- [ ] **Step 5: Limpiar variables de la shell**

```bash
unset GCP_SECRET
# Limpiar history (opcional pero recomendado)
history -d $(history | tail -10 | head -1 | awk '{print $1}')
```

---

## Task 5: Validación E2E — simular webhook desde MP dashboard

**Files:** ninguno modificado.

- [ ] **Step 1: Confirmar que el deploy actual tiene el código nuevo**

```bash
# Ver los últimos commits
git log --oneline -5

# Si los commits del fix NO están deployados (revisar con build_id reciente):
./scripts/deploy.sh

# Capturar URL
URL=$(gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format='value(status.url)')
echo "Servicio: $URL"
```

- [ ] **Step 2: Smoke check rápido**

```bash
curl -s -o /dev/null -w "GET / → HTTP %{http_code}\n" "$URL/"
curl -s -o /dev/null -w "GET /api/webhooks/mercadopago → HTTP %{http_code}\n" "$URL/api/webhooks/mercadopago"
```
Esperado:
- `GET /` → 200
- `GET /api/webhooks/mercadopago` → 200 (con body `{"status":"ready",...}`)

- [ ] **Step 3: Test 1 — webhook sin headers debe ser rechazado**

```bash
# POST sin headers de firma → debe ser 400 (sin data.id) o 401 (firma inválida)
curl -s -o /tmp/resp.json -w "HTTP %{http_code}\n" \
  -X POST "$URL/api/webhooks/mercadopago" \
  -H "Content-Type: application/json" \
  -d '{}'
cat /tmp/resp.json; echo ""
```
Esperado: HTTP **400** con body `{"error":"Missing data.id"}`. **Si devuelve 200 → BUG-008-D NO está corregido.**

- [ ] **Step 4: Test 2 — webhook con data.id pero sin firma debe ser rechazado**

```bash
curl -s -o /tmp/resp.json -w "HTTP %{http_code}\n" \
  -X POST "$URL/api/webhooks/mercadopago" \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","action":"payment.created","data":{"id":"123456"}}'
cat /tmp/resp.json; echo ""
```
Esperado: HTTP **401** con body `{"error":"Invalid signature"}`. **Si devuelve 200 → BUG-008 base NO está corregido.**

- [ ] **Step 5: Test 3 — webhook con firma forjada debe ser rechazado**

```bash
curl -s -o /tmp/resp.json -w "HTTP %{http_code}\n" \
  -X POST "$URL/api/webhooks/mercadopago" \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=1234567890,v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
  -H "x-request-id: forged-request-id-123" \
  -d '{"type":"payment","action":"payment.created","data":{"id":"123456"}}'
cat /tmp/resp.json; echo ""
```
Esperado: HTTP **401**. **Si devuelve 200 → la verificación HMAC NO está validando.**

- [ ] **Step 6: Test 4 — simular notificación VÁLIDA desde dashboard MP**

> Acción manual del usuario:
> 1. Ir a https://www.mercadopago.com.ar/developers/panel/app/3796491518010506/webhooks
> 2. Click en "Simular notificación" (botón al final del formulario).
> 3. Elegir evento "Pagos" → "payment.updated".
> 4. Click "Enviar prueba".

Después correr:
```bash
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --limit=50 --format="value(textPayload)" \
  | grep -iE "webhook|signature|payment" | tail -20
```
Esperado:
- Log `Webhook signature verified successfully` ← **clave: confirma que firma legítima ahora SÍ valida**
- Log `Processing webhook: type=payment...`
- HTTP `200` en la respuesta vista en MP dashboard
- (Probable: `Error fetching payment info: Payment not found` porque el id de la simulación es 123456 y no existe en MP — eso es OK, confirma que el flujo siguió hasta el fetch de payment data).
- Si después de la simulación viene un **503** porque "Payment not found" lanza desde `getPaymentInfo`: **eso es el comportamiento NUEVO esperado** (Task 2 retornaba 503 en errores transitorios). MP reintentará 3 veces.

- [ ] **Step 7: Diagnóstico si Test 4 falla con "Invalid webhook signature"**

Si la simulación de MP genera "Invalid webhook signature" en logs:
1. Confirmar que el código deployado es el nuevo (Step 1).
2. Comparar prefijo del secret en GCP vs MP (Task 4 Step 3).
3. Si coinciden, revisar si el usuario hizo Step 1 correctamente (redeploy reciente).
4. Como último recurso: agregar `console.log('manifest:', manifest)` y `console.log('expected:', expectedHash)` en `lib/webhook-verification.ts`, redeployar, simular, comparar manualmente con el `v1` que MP envió.

- [ ] **Step 8: (Si Tests 1-4 verdes) Resumir resultados**

```
Test 1 (sin data.id): PASS — 400
Test 2 (sin firma):    PASS — 401
Test 3 (firma falsa):  PASS — 401
Test 4 (firma legítima MP): PASS — 200 + "verified successfully" en logs
```

No hay commit en esta task — solo validación.

---

## Task 6: Documentar el fix

**Files:**
- Modify: `BUGS.md`
- Modify: `LEARNINGS.md`
- Modify: `MEMORIA.md`
- Modify: `ESTADO.md`

- [ ] **Step 1: Cerrar BUG-008 en `BUGS.md` con detalle expandido**

En `BUGS.md`, en la sección "Resumen", actualizar:
- "Resueltos": `7` → `8`
- "Pendientes": `1` → `0`

Después, reemplazar el bloque de BUG-008 (que estaba como PENDIENTE) por el siguiente — manteniendo el header pero cambiando el cuerpo:

```markdown
### BUG-008 | RESUELTO
- **Fecha detectado**: 2026-05-02 (durante cutover MP de migración Cloud Run, Task 9)
- **Fecha resuelto**: 2026-05-02
- **Descripción inicial**: El handler `app/api/webhooks/mercadopago/route.ts` aceptaba webhooks con firma HMAC inválida y devolvía HTTP 200.
- **Diagnóstico expandido (diagnosis-specialist)**: bajo el síntoma visible había 6 sub-bugs encadenados:
  - **008 base**: `return NextResponse.json({error:'Invalid signature'}, {status:401})` comentado desde commit inicial 2025-09-11 (`437776e4`). Era "temporal para testing" y nunca se restauró.
  - **008-A** (más grave): el manifest HMAC estaba mal construido. Código generaba `<paymentId>.<ts>` cuando MP exige `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Por esto **ninguna firma válida hubiera matcheado nunca**, incluso con secret correcto.
  - **008-B**: parseo del header `x-signature` por posición (`parts[0]`, `parts[1]`) en vez de por nombre. Frágil ante cambios de orden o campos extra.
  - **008-C**: `crypto.timingSafeEqual` lanza excepción con buffers de longitudes distintas; el catch externo la tragaba y devolvía 200.
  - **008-D**: bypass por header faltante — `if (!signature) return false` combinado con return 401 comentado dejaba que cualquier POST sin `x-signature` fuera procesado.
  - **008-E**: `RaffleService.confirmPayment` no era idempotente. MP retries (3 en ~22 min) sobreescribían `soldAt` y duplicaban event logs.
  - **008-F**: el catch externo del POST devolvía 200 incluso en errores transitorios. Comentario decía "para evitar reintentos" — anti-patrón: descartaba la red de seguridad de IPN.
- **Causa raíz**: implementación inicial del webhook (commit `437776e4`, 2025-09-11) usó un manifest simplificado para hacer pruebas rápidas en sandbox y nunca se reemplazó por el formato oficial. La rifa 2025 corrió con este bug; mitigación implícita fue que `getPaymentInfo(paymentId)` contra MP API filtraba IDs falsos por `external_reference`.
- **Solución aplicada**:
  - Nuevo módulo `lib/webhook-verification.ts` con manifest oficial + parseo robusto + validación de timestamp (mitiga replay attacks, MAX_TIMESTAMP_AGE_SECONDS=600).
  - 13 tests unitarios con `node:test` built-in en `tests/webhook-verification.test.mjs`.
  - Handler `app/api/webhooks/mercadopago/route.ts` reescrito: rechaza con 400 si falta `body.data.id`, 401 si firma inválida o secret no configurado, 503 en errores transitorios (habilita retries de MP).
  - `RaffleService.confirmPayment` ahora es idempotente: chequea `paymentStatus === 'approved'` y returns early si ya procesado.
- **Validación**:
  - 13 tests unitarios pasan.
  - 4 tests E2E manuales pasan (sin firma → 401, sin data.id → 400, firma forjada → 401, simulación dashboard MP → 200 + "verified successfully").
  - `npm run lint && npm run build` verdes.
- **Archivos afectados**: `lib/webhook-verification.ts` (nuevo), `tests/webhook-verification.test.mjs` (nuevo), `tests/run-tests.sh` (nuevo), `app/api/webhooks/mercadopago/route.ts`, `lib/services/raffleService.ts:347-384`, `package.json`.
- **Auditoría retroactiva pendiente**: query a `event_logs` 2025 para detectar webhooks procesados sin firma válida. **Tarea separada**, no crítica (MP API filtró IDs falsos por external_reference).
```

- [ ] **Step 2: Agregar 2 aprendizajes a `LEARNINGS.md`**

Buscar el header `### 2026-05-02 — Migración Vercel → Cloud Run` y agregar una sección debajo (antes del próximo header de fecha):

```markdown
### 2026-05-02 — Fix BUG-008 (webhook MercadoPago)

- **2026-05-02** Convención técnica — El manifest oficial para verificar HMAC de webhooks IPN de MercadoPago es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (separador `;`, trailing `;`, prefijos literales). NO es `<id>.<ts>` ni variantes. El header `x-signature` viene como `ts=...,v1=...` pero el orden NO está garantizado — siempre parsear por nombre. Validar timestamp contra reloj actual (≤10 min) mitiga replay attacks. _(Destino: solo registro)_ _(Origen: BUG-008-A diagnóstico)_

- **2026-05-02** Convención técnica — En el handler webhook MP, devolver **5xx en errores transitorios** (BD, MP API timeout, network) habilita la retry policy de MP (3 intentos en ~22 min). Devolver 200 en errores anti-patrón: descarta la red de seguridad. Solo devolver 200 en éxito explícito o ignorables (event types desconocidos). 4xx para validación (firma, body). _(Destino: solo registro)_ _(Origen: BUG-008-F)_

- **2026-05-02** Convención técnica — Funciones de verificación de seguridad (HMAC, JWT, etc.) NUNCA deben tirar excepción ante input malformado. Si `crypto.timingSafeEqual` con buffers de distinta longitud lanza, el catch externo del handler la traga y la lógica falla abierta (devuelve 200). Pre-validar longitudes y envolver en `try/catch` que devuelve `false` por default. _(Destino: solo registro)_ _(Origen: BUG-008-C)_
```

- [ ] **Step 3: Update `MEMORIA.md` — agregar nota a Sesión 2 (existente)**

Buscar la entrada `### Sesión 2 — 2026-05-02 (migración Vercel → Cloud Run)` y agregar al final del bloque "Logros":
```markdown
  - Fix BUG-008 completo: el bug "webhook acepta firmas inválidas" expandido a 6 sub-bugs (008 base + 008-A a 008-F). Plan ejecutado: nuevo `lib/webhook-verification.ts` con manifest oficial, 13 tests unitarios, handler reescrito para rechazar bypasses, idempotencia en `confirmPayment`, política 5xx para retries de MP. Validado E2E con simulación de dashboard MP.
```

- [ ] **Step 4: Update `ESTADO.md` — agregar bitácora del fix BUG-008**

En sección "## Bitácora", insertar al inicio (después del título, antes de la entrada del 2026-05-02 migración):

```markdown
### 2026-05-02 — BUG-008 cerrado (webhook MercadoPago seguro para Fase 4)
- **Resumen**: El bug detectado en Task 9 de la migración (webhook acepta firmas inválidas) se expandió a 6 sub-bugs encadenados durante el diagnóstico con `diagnosis-specialist`. Fix completo aplicado.
- **Bugs resueltos**: BUG-008 base + 008-A (manifest mal construido) + 008-B (parseo posicional) + 008-C (timingSafeEqual sin guard) + 008-D (bypass sin header) + 008-E (no idempotencia) + 008-F (200 en errores transitorios)
- **Acciones**:
  - Nuevo módulo `lib/webhook-verification.ts` con manifest oficial MP + parseo robusto + validación timestamp (replay protection)
  - 13 tests unitarios en `tests/webhook-verification.test.mjs` (node:test built-in, sin deps)
  - `app/api/webhooks/mercadopago/route.ts` reescrito: 400 si data.id falta, 401 firma inválida, 503 errores transitorios (habilita MP retries)
  - `RaffleService.confirmPayment` idempotente: skip si ya `approved`
  - `package.json`: nuevo script `npm run test`
  - Plan `docs/superpowers/plans/2026-05-02-fix-bug-008-webhook-mp.md`
- **Validación**: 13 tests OK, lint+build verdes, 4 tests E2E (3 rechazos + 1 simulación dashboard MP) verdes.
- **Pendiente**: Auditoría retroactiva de event_logs 2025 (no crítica, separable).
- **Próxima tarea**: 1.5 — `npm run dev` local + smoke test del flujo completo en sandbox MP, ahora con webhook seguro.
- **Archivos modificados**: ver Plan + meta-docs (CLAUDE/MEMORIA/ESTADO/BUGS/LEARNINGS).
```

En "## Próxima tarea" al final del archivo, mantener:
```markdown
**1.5** — `npm run dev` local + smoke test del flujo completo en sandbox MP, validando que la integración Cloud Run + Turso + MP no tiene regresiones, ahora con webhook seguro post-BUG-008.
```

- [ ] **Step 5: Verificar y commitear las docs**

```bash
git status --short
# esperado: M BUGS.md, M LEARNINGS.md, M MEMORIA.md, M ESTADO.md

git add BUGS.md LEARNINGS.md MEMORIA.md ESTADO.md
git commit -m "docs(bug-008): documentar fix completo del webhook MP

BUGS.md: BUG-008 cerrado con detalle expandido de los 6 sub-bugs
  identificados por diagnosis-specialist (008 base + 008-A a 008-F).
  Auditoría retroactiva 2025 queda como tarea separada.

LEARNINGS.md: 3 aprendizajes nuevos
  - Formato oficial del manifest HMAC para webhooks IPN de MP
  - Política 5xx en errores transitorios (habilita retries)
  - Funciones de verificación de seguridad nunca deben lanzar

MEMORIA.md: nota agregada a Sesión 2 sobre el fix completo.

ESTADO.md: bitácora 2026-05-02 segunda entrada con resumen del fix
  + próxima tarea 1.5 actualizada (smoke E2E en sandbox MP)."
```

---

## Criterios de éxito (gate final del plan)

Antes de declarar BUG-008 cerrado, todos verdes:

- [ ] `npm run test` — 13 tests pasan.
- [ ] `npm run lint` — sin errores nuevos (3 warnings pre-existentes OK).
- [ ] `npm run build` — genera `.next/standalone/server.js` sin errores TS.
- [ ] Test E2E 1 (sin data.id) → HTTP 400.
- [ ] Test E2E 2 (sin firma) → HTTP 401.
- [ ] Test E2E 3 (firma forjada) → HTTP 401.
- [ ] Test E2E 4 (simulación dashboard MP) → HTTP 200 + "Webhook signature verified successfully" en logs Cloud Run.
- [ ] BUGS.md tiene BUG-008 marcado como RESUELTO con causa raíz expandida.
- [ ] LEARNINGS.md tiene los 3 aprendizajes técnicos.
- [ ] Working tree clean.
- [ ] 4 commits encima del cd34f5d (cierre migración):
  - feat(webhook): módulo verifyMercadoPagoWebhookSignature con tests TDD
  - fix(webhook): restaurar verificación HMAC obligatoria + cerrar bypasses
  - fix(payment): idempotencia en RaffleService.confirmPayment
  - docs(bug-008): documentar fix completo del webhook MP

---

## Reviewers obligatorios (workflow FEATURE)

El reminder de FEATURE en CLAUDE.md prescribe:
- Cambios al flujo de pago → **`concurrency-validator`** (despachar después de Task 2 y Task 3 antes del commit final).
- Cambios a la BD → **`db-migration-reviewer`** (despachar después de Task 3).

En el modo `subagent-driven-development`, estos reviewers se invocan como **third stage** en las tasks correspondientes (después de spec compliance + code quality):

- Task 2: spec → code quality → **concurrency-validator**
- Task 3: spec → code quality → **db-migration-reviewer** → **concurrency-validator**

Si alguno de los dos reviewers extra encuentra issues, el implementer fixea antes de cerrar la task.

---

## Auditoría retroactiva — pendiente, NO en este plan

Como la rifa 2025 corrió con BUG-008-A activo desde 2025-09-11, conviene auditar `event_logs` para verificar que no se procesaron notifs malformadas. Esta task **no es parte de este plan** porque:
1. La defensa secundaria (`getPaymentInfo` + `external_reference`) tiende a haber filtrado IDs falsos.
2. La rifa 2025 ya cerró; la auditoría es informativa, no urgente.
3. El scope de este plan es prevenir el bug en Fase 4 (rifa 2026).

Tarea separable cuando haya tiempo:
```sql
SELECT
  el.id,
  el.eventType,
  el.purchaseId,
  el.createdAt,
  p.mercadoPagoPaymentId
FROM event_logs el
LEFT JOIN purchases p ON el.purchaseId = p.id
WHERE el.eventType IN ('PAYMENT_CONFIRMED', 'PAYMENT_CANCELLED')
  AND (p.id IS NULL OR p.mercadoPagoPaymentId IS NULL)
ORDER BY el.createdAt DESC;
```
Cualquier `event_log` sin `purchase` o sin `mercadoPagoPaymentId` indica anomalía a investigar.
