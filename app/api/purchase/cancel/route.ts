import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const cancelPurchaseSchema = z.object({
  purchaseId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Cancel purchase request:', body);
    
    // Validar datos
    const { purchaseId } = cancelPurchaseSchema.parse(body);
    
    // Cancelar la compra y liberar números
    const result = await RaffleService.cancelPayment(purchaseId);
    
    console.log(`Purchase ${purchaseId} cancelled successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Purchase cancelled and numbers released',
      purchaseId
    });
  } catch (error) {
    console.error('Error cancelling purchase:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to cancel purchase' },
      { status: 500 }
    );
  }
}