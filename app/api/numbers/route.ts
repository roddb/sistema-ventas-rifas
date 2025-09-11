import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';

export async function GET() {
  try {
    // Por ahora, simular los datos hasta que configuremos Turso
    // TODO: Descomentar cuando se configure la base de datos
    /*
    const raffle = await RaffleService.getActiveRaffle();
    if (!raffle) {
      return NextResponse.json({ error: 'No active raffle found' }, { status: 404 });
    }
    
    const numbers = await RaffleService.getRaffleNumbers(raffle.id);
    return NextResponse.json(numbers);
    */
    
    // Simulación temporal
    const numbers = [];
    for (let i = 1; i <= 2000; i++) {
      numbers.push({
        id: i,
        number: i,
        status: 'available'
      });
    }
    
    return NextResponse.json(numbers);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch numbers' },
      { status: 500 }
    );
  }
}