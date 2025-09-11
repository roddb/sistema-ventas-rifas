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
    console.log('Purchase request received:', body);
    const data = purchaseSchema.parse(body);
    
    // Obtener rifa activa
    const raffle = await RaffleService.getActiveRaffle();
    console.log('Active raffle:', raffle);
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
    console.log('Reserving numbers:', data.numbers);
    const reservationId = await RaffleService.reserveNumbers(raffle.id, data.numbers);
    console.log('Reservation ID:', reservationId);
    
    // Crear compra
    console.log('Creating purchase...');
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
    
    // NO confirmar automáticamente - esperar a que el frontend simule el pago
    console.log(`Purchase ${purchaseId} created. Waiting for payment confirmation...`);
    
    return NextResponse.json({
      success: true,
      purchaseId,
      reservationId
    });
  } catch (error) {
    console.error('Error creating purchase:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
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