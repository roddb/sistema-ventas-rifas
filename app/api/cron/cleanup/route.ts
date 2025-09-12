import { NextResponse } from 'next/server';
import { RaffleService } from '@/lib/services/raffleService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Este endpoint puede ser llamado por Vercel Cron Jobs o manualmente
// Para configurar en Vercel: vercel.json con cron schedule
export async function GET(request: Request) {
  try {
    // Verificar autorización (opcional - para Vercel Cron)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Si hay un secret configurado, verificarlo
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('Starting cleanup of expired reservations...');
    
    // Ejecutar limpieza
    const result = await RaffleService.releaseExpiredReservations();
    
    console.log('Cleanup completed:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in cleanup cron:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup expired reservations' },
      { status: 500 }
    );
  }
}

// También permitir POST para trigger manual
export async function POST(request: Request) {
  return GET(request);
}