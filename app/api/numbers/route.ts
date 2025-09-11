import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';

export async function GET() {
  try {
    // Obtener rifa activa
    const raffle = await RaffleService.getActiveRaffle();
    if (!raffle) {
      // Si no hay rifa activa, devolver números simulados para desarrollo
      const numbers = [];
      for (let i = 1; i <= 2000; i++) {
        numbers.push({
          id: i,
          number: i,
          status: 'available'
        });
      }
      return NextResponse.json(numbers);
    }
    
    // Obtener números de la base de datos
    const numbers = await RaffleService.getRaffleNumbers(raffle.id);
    return NextResponse.json(numbers);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch numbers' },
      { status: 500 }
    );
  }
}