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
