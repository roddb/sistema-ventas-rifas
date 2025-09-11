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
      .select()
      .from(raffleNumbers)
      .where(eq(raffleNumbers.raffleId, raffleId))
      .orderBy(raffleNumbers.number);
    
    return numbers;
  }

  // Reservar números temporalmente (15 minutos)
  static async reserveNumbers(raffleId: number, numberIds: number[]) {
    if (!this.isDbAvailable()) {
      return `TEMP-${nanoid(10)}`;
    }
    
    const reservationId = `TEMP-${nanoid(10)}`;
    const reservedAt = new Date();
    
    // Actualizar números a estado reservado
    // Usamos un loop porque inArray puede no funcionar bien con Turso
    for (const numberId of numberIds) {
      await db
        .update(raffleNumbers)
        .set({
          status: 'reserved',
          reservedAt,
          purchaseId: reservationId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(raffleNumbers.raffleId, raffleId),
            eq(raffleNumbers.status, 'available'),
            eq(raffleNumbers.number, numberId)
          )
        );
    }
    
    // Log del evento (sin purchaseId ya que es temporal)
    await db.insert(eventLogs).values({
      eventType: 'NUMBERS_RESERVED',
      data: JSON.stringify({ reservationId, numberIds, reservedAt })
    });
    
    return reservationId;
  }

  // Crear compra
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
  }) {
    if (!this.isDbAvailable()) {
      return `PUR-${nanoid(10)}`;
    }
    
    const purchaseId = `PUR-${nanoid(10)}`;
    
    // Crear registro de compra
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
    
    // Actualizar números con el ID de compra real
    for (const numberId of data.numberIds) {
      await db
        .update(raffleNumbers)
        .set({
          purchaseId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(raffleNumbers.raffleId, data.raffleId),
            eq(raffleNumbers.number, numberId)
          )
        );
    }
    
    // Crear relaciones en purchase_numbers
    const numberRecords = [];
    for (const numberId of data.numberIds) {
      const [record] = await db
        .select()
        .from(raffleNumbers)
        .where(
          and(
            eq(raffleNumbers.raffleId, data.raffleId),
            eq(raffleNumbers.number, numberId)
          )
        );
      if (record) numberRecords.push(record);
    }
    
    for (const num of numberRecords) {
      await db.insert(purchaseNumbers).values({
        purchaseId,
        raffleNumberId: num.id
      });
    }
    
    // Log del evento
    await db.insert(eventLogs).values({
      eventType: 'PURCHASE_CREATED',
      purchaseId,
      data: JSON.stringify(data)
    });
    
    return purchaseId;
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

  // Liberar números reservados que expiraron (más de 15 minutos)
  static async releaseExpiredReservations() {
    if (!this.isDbAvailable()) {
      return null;
    }
    
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const result = await db
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
    
    // Log del evento (sin purchaseId)
    await db.insert(eventLogs).values({
      eventType: 'EXPIRED_RESERVATIONS_RELEASED',
      data: JSON.stringify({ 
        releasedAt: new Date(),
        fifteenMinutesAgo 
      })
    });
    
    return result;
  }

  // Obtener estadísticas
  static async getStats(raffleId: number) {
    if (!this.isDbAvailable()) {
      return { total: 2000, sold: 0, reserved: 0, available: 2000 };
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