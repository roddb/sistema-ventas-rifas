/**
 * SCRIPT DE PRUEBA DE CONCURRENCIA - FASE 7 (CARRITO UNIFICADO)
 *
 * Reemplaza el test pre-Fase 7 (que apuntaba a /api/purchase, ahora borrado).
 * Apunta a /api/order/* nuevas routes.
 *
 * Uso:
 *   1. dev server corriendo: npm run dev (puerto 3000)
 *   2. node test-concurrency.js
 *
 * Zona de tests: números 1990-2000 (final del rango, baja probabilidad de uso real).
 * Cleanup: el script intenta cleanup post-scenario via /api/order/cancel; si falla,
 * los números pueden quedar reservados hasta el cron 15min.
 */

const BASE_URL = 'http://localhost:3000/api/order';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const log = (msg) => console.log(msg);
const ok = (msg) => log(`${colors.green}✓${colors.reset} ${msg}`);
const fail = (msg) => log(`${colors.red}✗${colors.reset} ${msg}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postOrder(body) {
  try {
    const res = await fetch(`${BASE_URL}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, json: { success: false, error: e.message } };
  }
}

async function cancelOrder(orderId) {
  try {
    await fetch(`${BASE_URL}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    /* swallow */
  }
}

function randomDelay() {
  return sleep(Math.floor(Math.random() * 200));
}

async function scenario1_overlappingCrossProduct() {
  log(`\n${colors.bright}=== Scenario 1: 2 users overlapping nums + cross-product ===${colors.reset}`);
  log('User A: nums [1990, 1991] + 2 sandwiches chorizo');
  log('User B: nums [1990, 1992] + 1 empanadas');
  log('Expected: 1 success, 1 error 409');

  const userABody = {
    buyer: { name: 'TestUserA', email: 'a@test.com', phone: '111', studentName: 'AA', division: 'A', course: '1' },
    raffle: { raffleId: 2, numberIds: [1990, 1991] },
    combos: [{ comboId: 'chorizo', quantity: 2 }],
  };
  const userBBody = {
    buyer: { name: 'TestUserB', email: 'b@test.com', phone: '222', studentName: 'BB', division: 'B', course: '1' },
    raffle: { raffleId: 2, numberIds: [1990, 1992] },
    combos: [{ comboId: 'empanadas', quantity: 1 }],
  };

  await randomDelay();
  const [resA, resB] = await Promise.all([
    randomDelay().then(() => postOrder(userABody)),
    randomDelay().then(() => postOrder(userBBody)),
  ]);

  log(`A: status=${resA.status}, success=${resA.json.success}, error="${resA.json.error ?? ''}", orderId=${resA.json.data?.orderId ?? 'none'}`);
  log(`B: status=${resB.status}, success=${resB.json.success}, error="${resB.json.error ?? ''}", orderId=${resB.json.data?.orderId ?? 'none'}`);

  const successCount = [resA.json.success, resB.json.success].filter(Boolean).length;
  if (successCount === 1) {
    ok('Scenario 1 PASSED: exactly 1 success and 1 race conflict');
  } else {
    fail(`Scenario 1 FAILED: expected 1 success, got ${successCount}`);
  }

  // Cleanup
  if (resA.json.data?.orderId) await cancelOrder(resA.json.data.orderId);
  if (resB.json.data?.orderId) await cancelOrder(resB.json.data.orderId);
}

async function scenario4_fourUsersCrossProduct() {
  log(`\n${colors.bright}=== Scenario 4: 4 users overlapping cross-product ===${colors.reset}`);
  log('A=[1990,1991,1992]+2 chorizo, B=[1992,1993,1994]+1 empanadas');
  log('C=[1994,1995,1996], D=[]+3 carne');
  log('Expected: 0 sobreventa en raffle_numbers');

  const requests = [
    {
      label: 'A',
      body: {
        buyer: { name: 'TestA', email: 'a@x.com', phone: '1', studentName: 'A', division: 'A', course: '1' },
        raffle: { raffleId: 2, numberIds: [1990, 1991, 1992] },
        combos: [{ comboId: 'chorizo', quantity: 2 }],
      },
    },
    {
      label: 'B',
      body: {
        buyer: { name: 'TestB', email: 'b@x.com', phone: '2', studentName: 'B', division: 'B', course: '1' },
        raffle: { raffleId: 2, numberIds: [1992, 1993, 1994] },
        combos: [{ comboId: 'empanadas', quantity: 1 }],
      },
    },
    {
      label: 'C',
      body: {
        buyer: { name: 'TestC', email: 'c@x.com', phone: '3', studentName: 'C', division: 'C', course: '1' },
        raffle: { raffleId: 2, numberIds: [1994, 1995, 1996] },
      },
    },
    {
      label: 'D',
      body: {
        buyer: { name: 'TestD', email: 'd@x.com', phone: '4' },
        combos: [{ comboId: 'carne', quantity: 3 }],
      },
    },
  ];

  await randomDelay();
  const results = await Promise.all(
    requests.map((r) => randomDelay().then(() => postOrder(r.body)).then((res) => ({ label: r.label, ...res })))
  );

  results.forEach((r) => {
    log(`User ${r.label}: status=${r.status}, success=${r.json.success}, error="${r.json.error ?? ''}", orderId=${r.json.data?.orderId ?? 'none'}`);
  });

  // Validación real: unión de numberIds en orders successful debe ser única
  const successfulRequests = requests
    .map((r, i) => ({ label: r.label, numberIds: r.body.raffle?.numberIds ?? [], success: results[i].json.success }))
    .filter((x) => x.success);

  const allNums = successfulRequests.flatMap((r) => r.numberIds);
  const dupes = allNums.filter((n, i) => allNums.indexOf(n) !== i);

  log(`Successful orders: ${successfulRequests.length}`);
  log(`All claimed nums: [${allNums.join(', ')}]`);

  if (dupes.length === 0) {
    ok(`Scenario 4 PASSED: anti-sobreventa preserved (${successfulRequests.length} orders, 0 duplicate nums)`);
  } else {
    fail(`Scenario 4 FAILED: duplicates detected ${[...new Set(dupes)].join(', ')} — sobreventa real`);
  }

  // Cleanup
  for (const r of results) {
    if (r.json.data?.orderId) await cancelOrder(r.json.data.orderId);
  }
}

async function scenario2_documentedManual() {
  log(`\n${colors.bright}=== Scenario 2: Cleanup vs webhook (DOCUMENTED MANUAL) ===${colors.reset}`);
  log('Setup: order with [1997,1998] + 1 combo creado a t=0');
  log('Trigger: cron /api/cron/cleanup llamado a t=15min (BUT requires clock mocking)');
  log('Expected: order cancelled, raffle_numbers liberados, NOT race con webhook tardío');
  log('Manual run: usar Turso MCP para INSERT order con created_at=NOW-16min y luego curl /api/cron/cleanup con CRON_SECRET');
}

async function scenario3_documentedManual() {
  log(`\n${colors.bright}=== Scenario 3: removeNumberFromOrder vs webhook (DOCUMENTED MANUAL) ===${colors.reset}`);
  log('Setup: order with [1999, 2000] + 1 combo. orderId, rafflePurchaseId capturados.');
  log('Trigger A: DELETE /api/order/items para quitar #2000');
  log('Trigger B: simular webhook ORD- con paymentId real → confirmOrderPayment');
  log('Expected: una sola escritura gana (lock optimista), no inconsistencias');
  log('Manual run: requiere webhook simulator con HMAC válido + paymentId real (MCP MP no disponible)');
}

async function main() {
  log(`${colors.bright}=== FASE 7 — CONCURRENCY TESTS CROSS-PRODUCT ===${colors.reset}`);
  log('Pre-requisitos: dev server en port 3000 (npm run dev)');
  log('Zona de tests: nums 1990-2000');

  // Healthcheck
  try {
    const res = await fetch('http://localhost:3000/api/numbers');
    if (!res.ok) throw new Error(`/api/numbers status ${res.status}`);
    log(`${colors.green}✓ Dev server alive${colors.reset}`);
  } catch (e) {
    log(`${colors.red}✗ Dev server NOT alive: ${e.message}${colors.reset}`);
    log('Run: npm run dev');
    process.exit(1);
  }

  await scenario1_overlappingCrossProduct();
  await scenario4_fourUsersCrossProduct();
  await scenario2_documentedManual();
  await scenario3_documentedManual();

  log(`\n${colors.bright}=== Tests completed ===${colors.reset}`);
  log('NOTA: cleanup post-scenarios via /api/order/cancel; números 1990-2000 deberían volver a available.');
  log('Si quedan reservados, esperar 15min para cron cleanup automático O cleanup manual via Turso MCP.');
}

main().catch((e) => {
  log(`${colors.red}ERROR FATAL: ${e.message}${colors.reset}`);
  process.exit(1);
});
