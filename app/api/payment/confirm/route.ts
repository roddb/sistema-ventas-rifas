import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const confirmPaymentSchema = z.object({
  purchaseId: z.string().min(1),
  paymentMethod: z.string().optional().default('simulation'),
  mercadoPagoPaymentId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Payment confirmation request:', body);
    const data = confirmPaymentSchema.parse(body);
    
    // Confirmar el pago y marcar números como vendidos
    await RaffleService.confirmPayment(data.purchaseId, {
      paymentMethod: data.paymentMethod,
      mercadoPagoPaymentId: data.mercadoPagoPaymentId
    });
    
    console.log(`Payment confirmed for purchase ${data.purchaseId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}