import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyMercadoPagoWebhookSignature, MAX_TIMESTAMP_AGE_SECONDS } from '../lib/webhook-verification.ts';

const SECRET = 'test-webhook-secret-1234567890';
const DATA_ID = '12345678901';
const REQUEST_ID = 'abc-def-ghi-jkl';

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

test('valid signature with ts in milliseconds returns true (MP sends ms)', () => {
  // MercadoPago envía el ts en milisegundos (epoch ms, 13 dígitos).
  const ts = Date.now().toString();
  const v1 = signManifest(SECRET, DATA_ID, REQUEST_ID, ts);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(ts, v1),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, true);
});

test('replay attack with milliseconds ts beyond window returns false', () => {
  // 30 minutos antes en ms — claramente fuera de la ventana de 10 min.
  const oldTsMs = (Date.now() - 30 * 60 * 1000).toString();
  const v1 = signManifest(SECRET, DATA_ID, REQUEST_ID, oldTsMs);
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(oldTsMs, v1),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
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
  const result = verifyMercadoPagoWebhookSignature({
    signatureHeader: buildHeader(ts, 'abcd'),
    requestId: REQUEST_ID,
    dataId: DATA_ID,
    secret: SECRET,
  });
  assert.equal(result, false);
});
