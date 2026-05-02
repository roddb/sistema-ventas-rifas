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
