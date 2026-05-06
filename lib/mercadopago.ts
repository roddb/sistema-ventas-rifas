import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000, idempotencyKey: 'abc' }
});

const preference = new Preference(client);
const payment = new Payment(client);

interface PreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

interface CreateOrderPreferenceData {
  orderId: string;
  buyer: { name: string; email: string };
  raffle?: { title: string; numbers: number[]; pricePerNumber: number };
  combos?: { id: string; name: string; quantity: number; unitPrice: number }[];
}

export async function createOrderPreference(data: CreateOrderPreferenceData) {
  try {
    console.log('[MP] Creating order preference for:', data.orderId);

    const items: PreferenceItem[] = [];

    if (data.raffle && data.raffle.numbers.length > 0) {
      // MP title limit = 256 chars. Si la lista de números no cabe en 200
      // chars (margen seguro), usar count en lugar de listar.
      const numbersList = data.raffle.numbers.join(', ');
      const fullTitle = `${data.raffle.title} - Números: ${numbersList}`;
      const title = fullTitle.length <= 200
        ? fullTitle
        : `${data.raffle.title} - ${data.raffle.numbers.length} números`;
      items.push({
        id: data.orderId,
        title,
        quantity: 1,
        unit_price: data.raffle.pricePerNumber * data.raffle.numbers.length,
        currency_id: 'ARS'
      });
    }

    if (data.combos && data.combos.length > 0) {
      for (const c of data.combos) {
        items.push({
          id: c.id,
          title: c.name,
          quantity: c.quantity,
          unit_price: c.unitPrice,
          currency_id: 'ARS'
        });
      }
    }

    if (items.length === 0) throw new Error('Order has no items');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
    const nNums = data.raffle?.numbers.length ?? 0;
    const nCombos = data.combos?.reduce((s, c) => s + c.quantity, 0) ?? 0;

    const preferenceData = {
      items,
      payer: { name: data.buyer.name, email: data.buyer.email },
      back_urls: {
        success: `${baseUrl}/api/order/payment/success`,
        failure: `${baseUrl}/api/order/payment/failure`,
        pending: `${baseUrl}/api/order/payment/pending`
      },
      external_reference: data.orderId,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      description: `STA - ${data.orderId} - ${nNums} nums + ${nCombos} combos`,
      statement_descriptor: 'RIFA STA',
      payment_methods: { excluded_payment_types: [], installments: 1, default_installments: 1 },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };

    const response = await preference.create({ body: preferenceData });
    console.log('[MP] Preference created:', { id: response.id, init_point: response.init_point });

    return {
      preferenceId: response.id!,
      initPoint: response.init_point!,
      sandboxInitPoint: response.sandbox_init_point!
    };
  } catch (error) {
    console.error('[MP] Error creating order preference:', error);
    throw new Error('Failed to create order payment preference');
  }
}

export async function getPaymentInfo(paymentId: string) {
  try {
    const response = await payment.get({ id: paymentId });
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

export async function isPaymentApproved(paymentId: string): Promise<boolean> {
  try {
    const info = await getPaymentInfo(paymentId);
    return info.status === 'approved';
  } catch {
    return false;
  }
}

export async function getPurchaseIdFromPayment(paymentId: string): Promise<string | null> {
  try {
    const info = await getPaymentInfo(paymentId);
    return info.externalReference || null;
  } catch {
    return null;
  }
}
