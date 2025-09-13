import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const verifySchema = z.object({
  numbers: z.array(z.number()).min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = verifySchema.parse(body);
    
    // Obtener rifa activa
    const raffle = await RaffleService.getActiveRaffle();
    
    if (!raffle) {
      return NextResponse.json({
        available: true,
        unavailableNumbers: []
      });
    }
    
    // Verificar disponibilidad
    const availability = await RaffleService.verifyNumbersAvailable(raffle.id, data.numbers);
    
    return NextResponse.json({
      available: availability.available,
      unavailableNumbers: availability.unavailableNumbers,
      message: availability.available 
        ? 'Todos los números están disponibles'
        : `Los números ${availability.unavailableNumbers.join(', ')} no están disponibles`
    });
    
  } catch (error) {
    console.error('Error verifying numbers:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al verificar disponibilidad' },
      { status: 500 }
    );
  }
}