import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

const { raffleNumbers, purchases, purchaseNumbers, eventLogs } = schema;

export const dynamic = 'force-dynamic';

// ENDPOINT SOLO PARA PRUEBAS - NO USAR EN PRODUCCIÓN
export async function POST(request: Request) {
  try {
    // Verificar que estamos en desarrollo
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Este endpoint no está disponible en producción' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { numbers, resetAll = false } = body;
    
    console.log('🧪 TEST ENDPOINT: Resetting numbers...', { numbers, resetAll });
    
    if (resetAll) {
      // Resetear TODOS los números a disponible
      console.log('Resetting ALL numbers to available...');
      
      // Limpiar todas las compras
      await db.delete(purchaseNumbers);
      await db.delete(purchases);
      
      // Resetear todos los números
      await db
        .update(raffleNumbers)
        .set({
          status: 'available',
          reservedAt: null,
          soldAt: null,
          purchaseId: null,
          updatedAt: new Date()
        });
      
      // Limpiar logs de eventos (opcional)
      await db.delete(eventLogs);
      
      return NextResponse.json({
        success: true,
        message: 'Todos los números han sido reseteados a disponible',
        resetCount: 2000
      });
      
    } else if (numbers && Array.isArray(numbers)) {
      // Resetear números específicos
      console.log(`Resetting specific numbers: ${numbers.join(', ')}`);
      
      for (const num of numbers) {
        // Primero encontrar si hay una compra asociada
        const [number] = await db
          .select()
          .from(raffleNumbers)
          .where(eq(raffleNumbers.number, num))
          .limit(1);
        
        if (number && number.purchaseId) {
          // Eliminar la relación purchase_numbers
          await db
            .delete(purchaseNumbers)
            .where(eq(purchaseNumbers.raffleNumberId, number.id));
        }
        
        // Resetear el número
        await db
          .update(raffleNumbers)
          .set({
            status: 'available',
            reservedAt: null,
            soldAt: null,
            purchaseId: null,
            updatedAt: new Date()
          })
          .where(eq(raffleNumbers.number, num));
      }
      
      return NextResponse.json({
        success: true,
        message: `Números ${numbers.join(', ')} reseteados a disponible`,
        resetCount: numbers.length
      });
    }
    
    return NextResponse.json(
      { error: 'Debes especificar numbers array o resetAll: true' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error resetting numbers:', error);
    return NextResponse.json(
      { error: 'Error al resetear números' },
      { status: 500 }
    );
  }
}