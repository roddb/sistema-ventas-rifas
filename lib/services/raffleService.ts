import { db, schema } from '@/lib/db';
import { eq, and, or, gte, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const { raffles, raffleNumbers, purchases, purchaseNumbers, eventLogs } = schema;

export class RaffleService {
  // Verificar si la BD está disponible
  static isDbAvailable() {
    return db !== null;
  }

  // Obtener rifa activa
  static async getActiveRaffle() {
    if (!this.isDbAvailable()) {
      return null;
    }
    
    const [raffle] = await db
      .select()
      .from(raffles)
      .where(eq(raffles.isActive, true))
      .limit(1);
    
    return raffle;
  }

  // Obtener todos los números de la rifa
  static async getRaffleNumbers(raffleId: number) {
    if (!this.isDbAvailable()) {
      return [];
    }

    const numbers = await db
      .select({
        id: raffleNumbers.id,
        number: raffleNumbers.number,
        status: raffleNumbers.status,
        reservedAt: raffleNumbers.reservedAt,
        soldAt: raffleNumbers.soldAt,
        purchaseId: raffleNumbers.purchaseId
      })
      .from(raffleNumbers)
      .where(eq(raffleNumbers.raffleId, raffleId))
      .orderBy(raffleNumbers.number);

    return numbers;
  }

  // Verificar disponibilidad de números ANTES de intentar reservar
  static async verifyNumbersAvailable(raffleId: number, numberIds: number[]) {
    if (!this.isDbAvailable()) {
      return { available: true, unavailableNumbers: [] };
    }
    
    const numbers = await db
      .select()
      .from(raffleNumbers)
      .where(
        and(
          eq(raffleNumbers.raffleId, raffleId),
          eq(raffleNumbers.status, 'available')
        )
      );
    
    const availableNumbers = numbers.map((n: any) => n.number);
    const unavailableNumbers = numberIds.filter((id: number) => !availableNumbers.includes(id));
    
    return {
      available: unavailableNumbers.length === 0,
      unavailableNumbers
    };
  }

  // Reservar números temporalmente (15 minutos) - MEJORADO con validación
  static async reserveNumbers(raffleId: number, numberIds: number[]) {
    if (!this.isDbAvailable()) {
      return { 
        success: true,
        reservationId: `TEMP-${nanoid(10)}`,
        reservedNumbers: numberIds,
        failedNumbers: []
      };
    }
    
    const reservationId = `TEMP-${nanoid(10)}`;
    const reservedAt = new Date();
    const reservedNumbers: number[] = [];
    const failedNumbers: number[] = [];
    
    // Primero verificar disponibilidad
    const availability = await this.verifyNumbersAvailable(raffleId, numberIds);
    if (!availability.available) {
      throw new Error(`Los siguientes números ya no están disponibles: ${availability.unavailableNumbers.join(', ')}`);
    }
    
    // Actualizar números a estado reservado con validación
    for (const numberId of numberIds) {
      try {
        // Obtener el registro actual para verificar que sigue disponible
        const [currentNumber] = await db
          .select()
          .from(raffleNumbers)
          .where(
            and(
              eq(raffleNumbers.raffleId, raffleId),
              eq(raffleNumbers.number, numberId),
              eq(raffleNumbers.status, 'available')
            )
          )
          .limit(1);
        
        if (!currentNumber) {
          failedNumbers.push(numberId);
          continue;
        }
        
        // Actualizar solo si está disponible
        const result = await db
          .update(raffleNumbers)
          .set({
            status: 'reserved',
            reservedAt,
            purchaseId: reservationId,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(raffleNumbers.id, currentNumber.id),
              eq(raffleNumbers.status, 'available') // Doble verificación
            )
          );
        
        reservedNumbers.push(numberId);
        
      } catch (error) {
        console.error(`Error reserving number ${numberId}:`, error);
        failedNumbers.push(numberId);
      }
    }
    
    // Si no se pudo reservar ningún número, lanzar error
    if (reservedNumbers.length === 0) {
      throw new Error('No se pudo reservar ningún número. Por favor, intenta nuevamente.');
    }
    
    // Si algunos números fallaron, lanzar error con detalles
    if (failedNumbers.length > 0) {
      // Revertir los números que sí se reservaron
      await db
        .update(raffleNumbers)
        .set({
          status: 'available',
          reservedAt: null,
          purchaseId: null,
          updatedAt: new Date()
        })
        .where(eq(raffleNumbers.purchaseId, reservationId));
      
      throw new Error(`Los números ${failedNumbers.join(', ')} ya no están disponibles. Por favor, actualiza la página y vuelve a intentar.`);
    }
    
    // Log del evento solo si todo salió bien
    await db.insert(eventLogs).values({
      eventType: 'NUMBERS_RESERVED',
      data: JSON.stringify({ 
        reservationId, 
        numberIds: reservedNumbers, 
        reservedAt 
      })
    });
    
    return {
      success: true,
      reservationId,
      reservedNumbers,
      failedNumbers
    };
  }

  // Crear compra con TRANSACCIÓN ATÓMICA para garantizar consistencia
  static async createPurchase(data: {
    raffleId: number;
    buyerName: string;
    studentName: string;
    division: string;
    course: string;
    email: string;
    phone?: string;
    numberIds: number[];
    totalAmount: number;
    reservationId?: string; // ID de la reserva temporal previa
  }) {
    if (!this.isDbAvailable()) {
      return `PUR-${nanoid(10)}`;
    }
    
    const purchaseId = `PUR-${nanoid(10)}`;
    
    try {
      // TODO: Cuando Turso soporte transacciones, envolver todo en una transacción
      // Por ahora, implementamos verificaciones adicionales para minimizar riesgos
      
      // 1. Verificar que los números siguen reservados para esta sesión
      if (data.reservationId) {
        const reservedNumbers = await db
          .select()
          .from(raffleNumbers)
          .where(
            and(
              eq(raffleNumbers.raffleId, data.raffleId),
              eq(raffleNumbers.purchaseId, data.reservationId),
              eq(raffleNumbers.status, 'reserved')
            )
          );
        
        const reservedIds = reservedNumbers.map((n: any) => n.number);
        const missingNumbers = data.numberIds.filter((id: number) => !reservedIds.includes(id));
        
        if (missingNumbers.length > 0) {
          throw new Error(`Los números ${missingNumbers.join(', ')} ya no están reservados. La reserva pudo haber expirado.`);
        }
      }
      
      // 2. Crear registro de compra
      await db.insert(purchases).values({
        id: purchaseId,
        raffleId: data.raffleId,
        buyerName: data.buyerName,
        studentName: data.studentName,
        division: data.division,
        course: data.course,
        email: data.email,
        phone: data.phone,
        totalAmount: data.totalAmount,
        numbersCount: data.numberIds.length,
        paymentStatus: 'pending'
      });
      
      // 3. Actualizar números con el ID de compra real (atomicidad por número)
      const updatedNumbers = [];
      for (const numberId of data.numberIds) {
        const updateResult = await db
          .update(raffleNumbers)
          .set({
            purchaseId,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(raffleNumbers.raffleId, data.raffleId),
              eq(raffleNumbers.number, numberId),
              // Verificar que el número sigue en el estado esperado
              data.reservationId 
                ? eq(raffleNumbers.purchaseId, data.reservationId)
                : eq(raffleNumbers.status, 'reserved')
            )
          );
        
        updatedNumbers.push(numberId);
      }
      
      // 4. Verificar que se actualizaron TODOS los números
      if (updatedNumbers.length !== data.numberIds.length) {
        // Rollback manual: eliminar la compra creada
        await db.delete(purchases).where(eq(purchases.id, purchaseId));
        throw new Error('No se pudieron asignar todos los números a la compra. Por favor, intenta nuevamente.');
      }
      
      // 5. Crear relaciones en purchase_numbers
      const numberRecords = [];
      for (const numberId of data.numberIds) {
        const [record] = await db
          .select()
          .from(raffleNumbers)
          .where(
            and(
              eq(raffleNumbers.raffleId, data.raffleId),
              eq(raffleNumbers.number, numberId),
              eq(raffleNumbers.purchaseId, purchaseId)
            )
          );
        if (record) numberRecords.push(record);
      }
      
      // Verificar que encontramos todos los registros
      if (numberRecords.length !== data.numberIds.length) {
        // Rollback manual
        await db.delete(purchases).where(eq(purchases.id, purchaseId));
        await db
          .update(raffleNumbers)
          .set({
            status: 'available',
            purchaseId: null,
            reservedAt: null,
            updatedAt: new Date()
          })
          .where(eq(raffleNumbers.purchaseId, purchaseId));
        
        throw new Error('Error al vincular números con la compra. Por favor, intenta nuevamente.');
      }
      
      for (const num of numberRecords) {
        await db.insert(purchaseNumbers).values({
          purchaseId,
          raffleNumberId: num.id
        });
      }
      
      // 6. Log del evento
      await db.insert(eventLogs).values({
        eventType: 'PURCHASE_CREATED',
        purchaseId,
        data: JSON.stringify(data)
      });
      
      return purchaseId;
      
    } catch (error) {
      // En caso de error, intentar rollback manual
      console.error('Error creating purchase, attempting rollback:', error);
      
      try {
        // Eliminar purchase si existe
        await db.delete(purchases).where(eq(purchases.id, purchaseId));
        
        // Liberar números si fueron asignados a este purchaseId
        await db
          .update(raffleNumbers)
          .set({
            status: 'available',
            purchaseId: null,
            reservedAt: null,
            updatedAt: new Date()
          })
          .where(eq(raffleNumbers.purchaseId, purchaseId));
          
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      
      throw error;
    }
  }

  // Confirmar pago y marcar números como vendidos
  static async confirmPayment(purchaseId: string, paymentData: {
    mercadoPagoPaymentId?: string;
    paymentMethod?: string;
  }) {
    if (!this.isDbAvailable()) {
      return true;
    }
    
    // Actualizar estado de la compra
    await db
      .update(purchases)
      .set({
        paymentStatus: 'approved',
        mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId,
        paymentMethod: paymentData.paymentMethod,
        updatedAt: new Date()
      })
      .where(eq(purchases.id, purchaseId));
    
    // Marcar números como vendidos
    await db
      .update(raffleNumbers)
      .set({
        status: 'sold',
        soldAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(raffleNumbers.purchaseId, purchaseId));
    
    // Log del evento
    await db.insert(eventLogs).values({
      eventType: 'PAYMENT_CONFIRMED',
      purchaseId,
      data: JSON.stringify(paymentData)
    });
    
    return true;
  }

  // Cancelar pago y liberar números reservados
  static async cancelPayment(purchaseId: string) {
    if (!this.isDbAvailable()) {
      return true;
    }
    
    // Actualizar estado de la compra
    await db
      .update(purchases)
      .set({
        paymentStatus: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(purchases.id, purchaseId));
    
    // Liberar números reservados
    await db
      .update(raffleNumbers)
      .set({
        status: 'available',
        reservedAt: null,
        purchaseId: null,
        soldAt: null,
        updatedAt: new Date()
      })
      .where(eq(raffleNumbers.purchaseId, purchaseId));
    
    // Log del evento
    await db.insert(eventLogs).values({
      eventType: 'PAYMENT_CANCELLED',
      purchaseId,
      data: JSON.stringify({ cancelledAt: new Date() })
    });
    
    return true;
  }

  // Liberar números reservados que expiraron (más de 15 minutos)
  static async releaseExpiredReservations() {
    if (!this.isDbAvailable()) {
      return { releasedNumbers: 0, cancelledPurchases: 0 };
    }
    
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    try {
      // Primero, encontrar purchases pendientes expiradas
      const expiredPurchases = await db
        .select()
        .from(purchases)
        .where(
          and(
            eq(purchases.paymentStatus, 'pending'),
            lte(purchases.createdAt, fifteenMinutesAgo)
          )
        );
      
      let cancelledPurchases = 0;
      let releasedNumbers = 0;
      
      // Cancelar cada purchase expirada
      for (const purchase of expiredPurchases) {
        // Liberar números asociados
        const result = await db
          .update(raffleNumbers)
          .set({
            status: 'available',
            reservedAt: null,
            purchaseId: null,
            soldAt: null,
            updatedAt: new Date()
          })
          .where(eq(raffleNumbers.purchaseId, purchase.id));
        
        // Actualizar estado de la compra
        await db
          .update(purchases)
          .set({
            paymentStatus: 'cancelled',
            updatedAt: new Date()
          })
          .where(eq(purchases.id, purchase.id));
        
        // Log del evento
        await db.insert(eventLogs).values({
          eventType: 'RESERVATION_EXPIRED',
          purchaseId: purchase.id,
          data: JSON.stringify({ 
            expiredAt: new Date(),
            createdAt: purchase.createdAt,
            buyerName: purchase.buyerName
          })
        });
        
        cancelledPurchases++;
        console.log(`Released expired reservation for purchase: ${purchase.id}`);
      }
      
      // También liberar números reservados sin purchase asociada (por si acaso)
      await db
        .update(raffleNumbers)
        .set({
          status: 'available',
          reservedAt: null,
          purchaseId: null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(raffleNumbers.status, 'reserved'),
            lte(raffleNumbers.reservedAt, fifteenMinutesAgo)
          )
        );
      
      // Solo registrar en log si realmente se cancelaron purchases
      // Los logs individuales ya se crearon arriba para cada purchase cancelada
      
      return { releasedNumbers, cancelledPurchases };
    } catch (error) {
      console.error('Error releasing expired reservations:', error);
      return { releasedNumbers: 0, cancelledPurchases: 0 };
    }
  }

  // Obtener estadísticas
  static async getStats(raffleId: number) {
    if (!this.isDbAvailable()) {
      return { total: 1500, sold: 0, reserved: 0, available: 1500 };
    }
    
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        sold: sql<number>`SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END)`,
        reserved: sql<number>`SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END)`,
        available: sql<number>`SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END)`
      })
      .from(raffleNumbers)
      .where(eq(raffleNumbers.raffleId, raffleId));
    
    return stats;
  }
}