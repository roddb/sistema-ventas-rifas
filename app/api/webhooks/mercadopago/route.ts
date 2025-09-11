import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { RaffleService } from '@/lib/services/raffleService';

export const dynamic = 'force-dynamic';

// Función para verificar la firma del webhook
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  
  // MercadoPago envía la firma en formato: ts=timestamp,v1=hash
  const parts = signature.split(',');
  const timestamp = parts[0]?.split('=')[1];
  const hash = parts[1]?.split('=')[1];
  
  if (!timestamp || !hash) return false;
  
  // Crear el mensaje a firmar: id.timestamp
  const message = `${payload}.${timestamp}`;
  
  // Generar hash HMAC con SHA256
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  // Comparar de forma segura
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== MercadoPago Webhook Received ===');
    
    // Obtener headers
    const headersList = headers();
    const signature = headersList.get('x-signature');
    const requestId = headersList.get('x-request-id');
    
    // Obtener el body
    const body = await request.json();
    console.log('Webhook body:', JSON.stringify(body, null, 2));
    
    // Verificar firma (si está configurado el webhook secret)
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (webhookSecret && body.data?.id) {
      const isValid = verifyWebhookSignature(
        body.data.id.toString(),
        signature,
        webhookSecret
      );
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        // Por ahora solo logueamos, no rechazamos (para testing)
        // return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      } else {
        console.log('Webhook signature verified successfully');
      }
    }
    
    // Procesar según el tipo de notificación
    const { type, action, data } = body;
    
    console.log(`Processing webhook: type=${type}, action=${action}, id=${data?.id}`);
    
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
    
    // MercadoPago espera un 200 OK
    return NextResponse.json({ 
      received: true,
      requestId,
      timestamp: new Date().toISOString()
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Devolver 200 para evitar reintentos de MercadoPago
    // pero loguear el error para debugging
    return NextResponse.json({ 
      received: true,
      error: 'Internal processing error (logged)'
    }, { status: 200 });
  }
}

// Handler para notificaciones de pago
async function handlePaymentNotification(paymentId: string, action?: string) {
  console.log(`Handling payment notification: ${paymentId}, action: ${action}`);
  
  try {
    // Importamos las funciones necesarias
    const { getPaymentInfo, isPaymentApproved } = await import('@/lib/mercadopago');
    
    // 1. Obtener detalles del pago desde la API de MercadoPago
    const paymentInfo = await getPaymentInfo(paymentId);
    console.log('Payment details:', paymentInfo);
    
    // 2. Verificar el estado del pago
    const purchaseId = paymentInfo.externalReference;
    if (!purchaseId) {
      console.error('No external reference (purchaseId) in payment');
      return;
    }
    
    // 3. Actualizar nuestra base de datos según el estado
    if (paymentInfo.status === 'approved') {
      console.log(`Payment approved! Confirming purchase ${purchaseId}`);
      await RaffleService.confirmPayment(purchaseId, {
        paymentMethod: paymentInfo.paymentMethod?.id || 'mercadopago',
        mercadoPagoPaymentId: paymentId
      });
    } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
      console.log(`Payment ${paymentInfo.status}. Cancelling purchase ${purchaseId}`);
      await RaffleService.cancelPayment(purchaseId);
    } else {
      console.log(`Payment status: ${paymentInfo.status} - No action taken`);
    }
    
  } catch (error) {
    console.error('Error handling payment notification:', error);
    throw error;
  }
}

// Endpoint GET para verificación de MercadoPago
export async function GET(request: NextRequest) {
  console.log('Webhook GET request received - returning status');
  
  return NextResponse.json({ 
    status: 'ready',
    endpoint: '/api/webhooks/mercadopago',
    timestamp: new Date().toISOString()
  }, { status: 200 });
}