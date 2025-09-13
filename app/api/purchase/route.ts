import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    
    // NUEVO: Verificar disponibilidad ANTES de intentar reservar
    console.log('Verifying availability for numbers:', data.numbers);
    const availability = await RaffleService.verifyNumbersAvailable(raffle.id, data.numbers);
    
    if (!availability.available) {
      console.log('Numbers not available:', availability.unavailableNumbers);
      return NextResponse.json(
        { 
          error: 'Algunos números ya no están disponibles',
          unavailableNumbers: availability.unavailableNumbers,
          message: `Los números ${availability.unavailableNumbers.join(', ')} ya fueron reservados por otro usuario. Por favor, actualiza la página y selecciona otros números.`
        },
        { status: 409 } // 409 Conflict
      );
    }
    
    // Reservar números con validación mejorada
    console.log('Reserving numbers:', data.numbers);
    const reservationResult = await RaffleService.reserveNumbers(raffle.id, data.numbers);
    
    if (!reservationResult.success) {
      console.error('Failed to reserve numbers:', reservationResult);
      return NextResponse.json(
        { 
          error: 'No se pudieron reservar los números',
          failedNumbers: reservationResult.failedNumbers,
          message: 'Algunos números ya no están disponibles. Por favor, actualiza la página.'
        },
        { status: 409 }
      );
    }
    
    console.log('Reservation successful:', reservationResult.reservationId);
    
    // Crear compra con el ID de reserva para mantener consistencia
    console.log('Creating purchase with reservation ID...');
    const purchaseId = await RaffleService.createPurchase({
      raffleId: raffle.id,
      buyerName: data.buyerName,
      studentName: data.studentName,
      division: data.division,
      course: data.course,
      email: data.email,
      phone: data.phone,
      numberIds: data.numbers,
      totalAmount: data.totalAmount,
      reservationId: reservationResult.reservationId // Pasar el ID de reserva
    });
    
    console.log(`Purchase ${purchaseId} created successfully. Waiting for payment confirmation...`);
    
    return NextResponse.json({
      success: true,
      purchaseId,
      reservationId: reservationResult.reservationId,
      reservedNumbers: reservationResult.reservedNumbers
    });
    
  } catch (error) {
    console.error('Error creating purchase:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de formulario inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    // Manejar errores específicos de disponibilidad
    if (error instanceof Error && error.message.includes('no están disponibles')) {
      return NextResponse.json(
        { 
          error: error.message,
          userMessage: error.message
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Error al procesar la compra. Por favor, intenta nuevamente.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}