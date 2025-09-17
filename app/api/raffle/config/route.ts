import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Obtener rifa activa con toda su configuración
    const raffle = await RaffleService.getActiveRaffle();
    
    if (!raffle) {
      // Si no hay rifa activa, devolver valores por defecto para desarrollo
      return NextResponse.json({
        id: null,
        title: 'Rifa de Desarrollo',
        description: 'Rifa de prueba',
        totalNumbers: 1500,
        pricePerNumber: 1000,
        startDate: new Date(),
        endDate: new Date(),
        isActive: false
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    // Devolver configuración de la rifa activa
    return NextResponse.json({
      id: raffle.id,
      title: raffle.title,
      description: raffle.description,
      totalNumbers: raffle.totalNumbers,
      pricePerNumber: raffle.pricePerNumber,
      startDate: raffle.startDate,
      endDate: raffle.endDate,
      isActive: raffle.isActive
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching raffle config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch raffle configuration' },
      { status: 500 }
    );
  }
}