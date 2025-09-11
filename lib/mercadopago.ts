import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// Configurar cliente de MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: {
    timeout: 5000,
    idempotencyKey: 'abc' // Esto se puede hacer dinámico si es necesario
  }
});

// Cliente para preferencias
const preference = new Preference(client);

// Cliente para pagos
const payment = new Payment(client);

interface PreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

interface CreatePreferenceData {
  purchaseId: string;
  buyerName: string;
  email: string;
  numbers: number[];
  totalAmount: number;
}

/**
 * Crear una preferencia de pago en MercadoPago
 */
export async function createPaymentPreference(data: CreatePreferenceData) {
  try {
    console.log('Creating MercadoPago preference for purchase:', data.purchaseId);
    
    // Crear los items de la preferencia
    const items: PreferenceItem[] = [{
      id: data.purchaseId,
      title: `Rifa Escolar 2025 - Números: ${data.numbers.join(', ')}`,
      quantity: 1,
      unit_price: data.totalAmount,
      currency_id: 'ARS'
    }];

    // Crear la preferencia
    const preferenceData = {
      items,
      payer: {
        name: data.buyerName,
        email: data.email
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas.vercel.app'}/api/payment/success`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas.vercel.app'}/api/payment/failure`,
        pending: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas.vercel.app'}/api/payment/pending`
      },
      auto_return: 'approved' as const,
      external_reference: data.purchaseId,
      notification_url: 'https://sistema-ventas-rifas.vercel.app/api/webhooks/mercadopago',
      statement_descriptor: 'RIFA ESCOLAR',
      payment_methods: {
        excluded_payment_types: [],
        installments: 1, // Sin cuotas
        default_installments: 1
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos
    };

    const response = await preference.create({ body: preferenceData });
    
    console.log('MercadoPago preference created:', {
      id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point
    });

    return {
      preferenceId: response.id!,
      initPoint: response.init_point!, // URL de pago en producción
      sandboxInitPoint: response.sandbox_init_point! // URL de pago en sandbox
    };
  } catch (error) {
    console.error('Error creating MercadoPago preference:', error);
    throw new Error('Failed to create payment preference');
  }
}

/**
 * Obtener información de un pago
 */
export async function getPaymentInfo(paymentId: string) {
  try {
    console.log('Fetching payment info for:', paymentId);
    
    const response = await payment.get({ id: paymentId });
    
    console.log('Payment info:', {
      id: response.id,
      status: response.status,
      status_detail: response.status_detail,
      external_reference: response.external_reference,
      transaction_amount: response.transaction_amount,
      payment_method: response.payment_method,
      payer: response.payer
    });

    return {
      id: response.id,
      status: response.status,
      statusDetail: response.status_detail,
      externalReference: response.external_reference,
      amount: response.transaction_amount,
      paymentMethod: response.payment_method,
      payerEmail: response.payer?.email
    };
  } catch (error) {
    console.error('Error fetching payment info:', error);
    throw new Error('Failed to get payment information');
  }
}

/**
 * Verificar si un pago está aprobado
 */
export async function isPaymentApproved(paymentId: string): Promise<boolean> {
  try {
    const paymentInfo = await getPaymentInfo(paymentId);
    return paymentInfo.status === 'approved';
  } catch (error) {
    console.error('Error checking payment status:', error);
    return false;
  }
}

/**
 * Obtener el ID de compra desde un pago
 */
export async function getPurchaseIdFromPayment(paymentId: string): Promise<string | null> {
  try {
    const paymentInfo = await getPaymentInfo(paymentId);
    return paymentInfo.externalReference || null;
  } catch (error) {
    console.error('Error getting purchase ID from payment:', error);
    return null;
  }
}