import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

const { raffles, raffleNumbers } = schema;

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

    const availableNumbers = numbers.map((n: { number: number }) => n.number);
    const unavailableNumbers = numberIds.filter((id: number) => !availableNumbers.includes(id));

    return {
      available: unavailableNumbers.length === 0,
      unavailableNumbers
    };
  }
}
