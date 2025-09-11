import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';
import { z } from 'zod';

const cancelPaymentSchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().optional().default('User cancelled or payment failed')
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Payment cancellation request:', body);
    const data = cancelPaymentSchema.parse(body);
    
    // Cancelar el pago y liberar números
    await RaffleService.cancelPayment(data.purchaseId);
    
    console.log(`Payment cancelled for purchase ${data.purchaseId}. Reason: ${data.reason}`);
    
    return NextResponse.json({
      success: true,
      message: 'Payment cancelled and numbers released successfully'
    });
  } catch (error) {
    console.error('Error cancelling payment:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to cancel payment' },
      { status: 500 }
    );
  }
}