import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyMercadoPagoWebhookSignature } from '@/lib/webhook-verification';
import { OrderService } from '@/lib/services/orderService';
import { db, schema } from '@/lib/db';

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
      case 'payment': {
        const dispatchResponse = await handlePaymentNotification(dataId, action);
        if (dispatchResponse) return dispatchResponse;
        break;
      }

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
      },
      { status: 503 }
    );
  }
}

// Mirrors the return type of getPaymentInfo() in lib/mercadopago.ts.
// Defined as a local interface to avoid dynamic-import-in-type-position limitations.
// Note: `id` is number (MP payment IDs are integers); `paymentMethod` is the SDK PaymentMethod object.
interface PaymentInfo {
  id: number | undefined;
  status: string | undefined;
  statusDetail: string | undefined;
  externalReference: string | undefined | null;
  amount: number | undefined;
  paymentMethod: { id?: string; type?: string } | undefined | null;
  payerEmail: string | undefined;
}

// Dispatcher principal — obtiene detalles del pago y delega por prefijo del external_reference.
// HMAC verification, idempotencia y manejo 5xx están ANTES de este punto (intactos).
// Returns a NextResponse for ORD-/PUR-/COM-/unknown refs, or undefined for no-op cases.
async function handlePaymentNotification(
  paymentId: string,
  action?: string
): Promise<NextResponse | undefined> {
  console.log(`Handling payment notification: ${paymentId}, action: ${action}`);

  const { getPaymentInfo } = await import('@/lib/mercadopago');

  // 1. Obtener detalles del pago desde la API de MercadoPago
  const paymentInfo: PaymentInfo = await getPaymentInfo(paymentId);
  console.log('Payment details:', paymentInfo);

  // 2. Verificar el estado del pago
  const purchaseId = paymentInfo.externalReference;
  if (!purchaseId) {
    console.error('No external reference (purchaseId) in payment');
    return;
  }

  // 3. Dispatch por prefijo del external_reference
  const ref = purchaseId;

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
    // I-1: purchaseId=null para evitar FK violation si el ref no existe en purchases.
    // Mismo patrón que LEGACY_COM_WEBHOOK_IGNORED. ref preservado en data JSON.
    await db.insert(schema.eventLogs).values({
      eventType: 'LEGACY_PUR_WEBHOOK_IGNORED',
      purchaseId: null,
      data: JSON.stringify({ legacyRef: ref, paymentInfo }),
      createdAt: new Date(),
    });
    return NextResponse.json({ received: true, ignored: 'legacy_PUR' }, { status: 200 });
  }

  if (ref.startsWith('COM-')) {
    console.warn(`[Webhook] Legacy COM- received post-Fase 7: ${ref}`);
    await db.insert(schema.eventLogs).values({
      eventType: 'LEGACY_COM_WEBHOOK_IGNORED',
      purchaseId: null,
      data: JSON.stringify({ comboPurchaseRef: ref, paymentInfo }),
      createdAt: new Date(),
    });
    return NextResponse.json({ received: true, ignored: 'legacy_COM' }, { status: 200 });
  }

  console.error(`[Webhook] UNKNOWN_REFERENCE: ${ref}`);
  await db.insert(schema.eventLogs).values({
    eventType: 'UNKNOWN_REFERENCE',
    purchaseId: null,
    data: JSON.stringify({ paymentId, externalReference: ref }),
    createdAt: new Date(),
  });
  return NextResponse.json({ received: true, ignored: 'unknown_ref' }, { status: 200 });
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
