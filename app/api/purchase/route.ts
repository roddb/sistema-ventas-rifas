import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';
import { z } from 'zod';

const purchaseSchema = z.object({
  buyerName: z.string().min(1),
  studentName: z.string().min(1),
  division: z.string().min(1),
  course: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  numbers: z.array(z.number()).min(1),
  totalAmount: z.number().positive()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = purchaseSchema.parse(body);
    
    // Obtener rifa activa
    const raffle = await RaffleService.getActiveRaffle();
    if (!raffle) {
      // Si no hay rifa activa, usar simulación para desarrollo
      const purchaseId = `PUR-${Date.now()}`;
      const reservationId = `TEMP-${Date.now()}`;
      
      return NextResponse.json({
        success: true,
        purchaseId,
        reservationId
      });
    }
    
    // Reservar números
    const reservationId = await RaffleService.reserveNumbers(raffle.id, data.numbers);
    
    // Crear compra
    const purchaseId = await RaffleService.createPurchase({
      raffleId: raffle.id,
      buyerName: data.buyerName,
      studentName: data.studentName,
      division: data.division,
      course: data.course,
      email: data.email,
      phone: data.phone,
      numberIds: data.numbers,
      totalAmount: data.totalAmount
    });
    
    // Simular aprobación de pago (temporal, hasta integrar MercadoPago)
    await RaffleService.confirmPayment(purchaseId, {
      paymentMethod: 'simulation'
    });
    
    return NextResponse.json({
      success: true,
      purchaseId,
      reservationId
    });
  } catch (error) {
    console.error('Error creating purchase:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create purchase' },
      { status: 500 }
    );
  }
}