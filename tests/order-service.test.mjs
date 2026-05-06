import { test } from 'node:test';
import assert from 'node:assert/strict';

test('OrderService module loads without errors', async () => {
  const mod = await import('../lib/services/orderService.ts');
  assert.ok(mod.OrderService, 'OrderService should be exported');
  assert.equal(typeof mod.OrderService.isDbAvailable, 'function');
  assert.equal(typeof mod.OrderService.createOrder, 'function');
  assert.equal(typeof mod.OrderService.cancelOrder, 'function');
  assert.equal(typeof mod.OrderService.confirmOrderPayment, 'function');
  assert.equal(typeof mod.OrderService.removeNumberFromOrder, 'function');
  assert.equal(typeof mod.OrderService.releaseExpiredOrders, 'function');
});
