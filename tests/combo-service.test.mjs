import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal, getComboById } from '../lib/combos.ts';

// Tests focales en la lógica server-side de validación.
// La integración con BD se cubre en smoke E2E (Task 20).

test('server total recalcula desde COMBOS, ignora total del cliente', () => {
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
    { comboId: 'pizza', quantity: 99 },
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

test('getComboById es case-sensitive', () => {
  assert.equal(getComboById('Chorizo'), null);
  assert.ok(getComboById('chorizo'));
});
