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
        await handlePaymentNotification(dataId, action);
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
  paymentMethod: { id?: string } | undefined | null;
  payerEmail: string | undefined;
}

// Dispatcher principal — obtiene detalles del pago y delega por prefijo del external_reference.
// HMAC verification, idempotencia y manejo 5xx están ANTES de este punto (intactos).
async function handlePaymentNotification(paymentId: string, action?: string) {
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
  if (purchaseId.startsWith('PUR-')) {
    await handleRifaPayment(purchaseId, paymentInfo, paymentId);
  } else if (purchaseId.startsWith('COM-')) {
    await handleComboPayment(purchaseId, paymentInfo, paymentId);
  } else {
    console.log(`Unknown external_reference prefix: ${purchaseId}`);
    const { db, schema } = await import('@/lib/db');
    await db.insert(schema.eventLogs).values({
      eventType: 'UNKNOWN_REFERENCE',
      purchaseId: null,
      data: JSON.stringify({ paymentId, externalReference: purchaseId }),
    });
  }
}

// Rifa flow — lógica extraída de handlePaymentNotification original, comportamiento IDÉNTICO.
// Verifica números reservados antes de confirmar; cancela en rejected/cancelled.
async function handleRifaPayment(
  purchaseId: string,
  paymentInfo: PaymentInfo,
  paymentId: string
): Promise<void> {
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

// Combo flow — sin stock limitado ni reservas; delega directamente a ComboService.
async function handleComboPayment(
  comboPurchaseId: string,
  paymentInfo: PaymentInfo,
  paymentId: string
): Promise<void> {
  const { ComboService } = await import('@/lib/services/comboService');

  if (paymentInfo.status === 'approved') {
    console.log(`Combo payment approved for ${comboPurchaseId}`);
    await ComboService.confirmComboPayment({
      comboPurchaseId,
      paymentId,
      paymentMethod: paymentInfo.paymentMethod?.id ?? 'mercadopago',
    });
    console.log(`Combo purchase ${comboPurchaseId} confirmed`);
  } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
    console.log(`Combo payment ${paymentInfo.status} for ${comboPurchaseId}`);
    await ComboService.cancelComboPayment({
      comboPurchaseId,
      reason: `payment ${paymentInfo.status}`,
    });
  } else {
    console.log(`Combo payment status: ${paymentInfo.status} - No action`);
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
