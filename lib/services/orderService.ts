import { db, schema } from '../db';
import { eq, and, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { calculateTotal, getComboById, type CartItem } from '../combos';

const { orders, purchases, comboPurchases, comboPurchaseItems, raffleNumbers, eventLogs, purchaseNumbers, raffles } = schema;

export interface OrderBuyer {
  name: string;
  email: string;
  phone?: string;
  studentName?: string;
  division?: string;
  course?: string;
}

export interface CreateOrderInput {
  buyer: OrderBuyer;
  raffle?: { raffleId: number; numberIds: number[] };
  combos?: CartItem[];
}

export interface CreateOrderResult {
  orderId: string;
  raffleChildId?: string;
  comboChildId?: string;
  totalAmount: number;
}

export class OrderService {
  static isDbAvailable(): boolean {
    return db !== null;
  }

  static async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!this.isDbAvailable()) {
      throw new Error('Database not available');
    }

    const hasRaffle = !!input.raffle && input.raffle.numberIds.length > 0;
    const hasCombos = !!input.combos && input.combos.length > 0;

    if (!hasRaffle && !hasCombos) {
      throw new Error('Order must have at least raffle or combos');
    }

    if (hasRaffle && (input.raffle!.numberIds.length < 1 || input.raffle!.numberIds.length > 10)) {
      throw new Error('Cap de números rifa: 1-10 por order');
    }

    if (hasRaffle && (!input.buyer.studentName || !input.buyer.division || !input.buyer.course)) {
      throw new Error('Datos del estudiante requeridos cuando hay rifa');
    }

    const orderId = `ORD-${nanoid(10)}`;

    return db.transaction(async (tx: any) => {
      // Lookup raffle config para calcular totalAmount server-side (anti-tampering)
      const raffleConfig = hasRaffle
        ? await tx.select().from(raffles).where(eq(raffles.id, input.raffle!.raffleId)).limit(1).then((r: any[]) => r[0])
        : null;
      if (hasRaffle && !raffleConfig) throw new Error(`Raffle ${input.raffle!.raffleId} not found`);

      const raffleTotal = hasRaffle ? raffleConfig.pricePerNumber * input.raffle!.numberIds.length : 0;
      const validComboItems = hasCombos
        ? input.combos!.filter((it) => it.quantity > 0 && getComboById(it.comboId))
        : [];
      if (hasCombos && validComboItems.length === 0) throw new Error('No valid combo items');
      const comboTotal = validComboItems.length > 0 ? calculateTotal(validComboItems) : 0;
      const totalAmount = raffleTotal + comboTotal;

      // 1. INSERT order
      await tx.insert(orders).values({
        id: orderId,
        buyerName: input.buyer.name,
        email: input.buyer.email,
        phone: input.buyer.phone ?? null,
        studentName: input.buyer.studentName ?? null,
        division: input.buyer.division ?? null,
        course: input.buyer.course ?? null,
        totalAmount,
        hasRaffle,
        hasCombos: validComboItems.length > 0,
        paymentStatus: 'pending',
      });

      let raffleChildId: string | undefined;
      let comboChildId: string | undefined;

      // 2. Hija rifa
      if (hasRaffle) {
        raffleChildId = `PUR-${nanoid(10)}`;
        await tx.insert(purchases).values({
          id: raffleChildId,
          raffleId: input.raffle!.raffleId,
          orderId,
          buyerName: input.buyer.name,
          studentName: input.buyer.studentName!,
          division: input.buyer.division!,
          course: input.buyer.course!,
          email: input.buyer.email,
          phone: input.buyer.phone ?? null,
          totalAmount: raffleTotal,
          numbersCount: input.raffle!.numberIds.length,
          paymentStatus: 'pending',
        });

        const reservedAt = new Date();
        for (const num of input.raffle!.numberIds) {
          const result = await tx.update(raffleNumbers)
            .set({ status: 'reserved', reservedAt, purchaseId: raffleChildId, updatedAt: new Date() })
            .where(and(
              eq(raffleNumbers.raffleId, input.raffle!.raffleId),
              eq(raffleNumbers.number, num),
              eq(raffleNumbers.status, 'available')
            ))
            .returning({ id: raffleNumbers.id });
          if (result.length === 0) {
            throw new Error(`Número ${num} no disponible (race con otro user o ya reservado)`);
          }
          await tx.insert(purchaseNumbers).values({
            purchaseId: raffleChildId,
            raffleNumberId: result[0].id,
          });
        }

        await tx.insert(eventLogs).values({
          eventType: 'PURCHASE_CREATED',
          purchaseId: raffleChildId,
          orderId,
          data: JSON.stringify({ orderId, numberIds: input.raffle!.numberIds, totalAmount: raffleTotal }),
        });
      }

      // 3. Hija combos
      if (validComboItems.length > 0) {
        const itemsCount = validComboItems.reduce((s, it) => s + it.quantity, 0);
        comboChildId = `COM-${nanoid(8)}`;
        await tx.insert(comboPurchases).values({
          id: comboChildId,
          orderId,
          buyerName: input.buyer.name,
          email: input.buyer.email,
          phone: input.buyer.phone ?? '',
          totalAmount: comboTotal,
          itemsCount,
          paymentStatus: 'pending',
        });
        for (const item of validComboItems) {
          const combo = getComboById(item.comboId)!;
          await tx.insert(comboPurchaseItems).values({
            comboPurchaseId: comboChildId,
            comboId: combo.id,
            comboNameSnapshot: combo.name,
            unitPrice: combo.price,
            quantity: item.quantity,
          });
        }
        await tx.insert(eventLogs).values({
          eventType: 'COMBO_PURCHASE_CREATED',
          purchaseId: comboChildId,
          orderId,
          data: JSON.stringify({ orderId, items: validComboItems, totalAmount: comboTotal }),
        });
      }

      // 4. Log del order
      await tx.insert(eventLogs).values({
        eventType: 'ORDER_CREATED',
        orderId,
        data: JSON.stringify({ hasRaffle, hasCombos: validComboItems.length > 0, totalAmount, raffleChildId, comboChildId }),
      });

      return { orderId, raffleChildId, comboChildId, totalAmount };
    });
  }

  static async cancelOrder(orderId: string): Promise<void> {
    if (!this.isDbAvailable()) return;

    await db.transaction(async (tx: any) => {
      const orderUpdate = await tx.update(orders)
        .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'pending')))
        .returning({ id: orders.id });

      if (orderUpdate.length === 0) {
        await tx.insert(eventLogs).values({
          eventType: 'ORDER_CANCEL_RACE',
          orderId,
          data: JSON.stringify({ reason: 'order_not_pending' }),
        });
        return;
      }

      const raffleChildren = await tx.select({ id: purchases.id })
        .from(purchases).where(eq(purchases.orderId, orderId));
      for (const child of raffleChildren) {
        await tx.update(purchases)
          .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
          .where(and(eq(purchases.id, child.id), eq(purchases.paymentStatus, 'pending')));
        await tx.update(raffleNumbers)
          .set({ status: 'available', reservedAt: null, purchaseId: null, soldAt: null, updatedAt: new Date() })
          .where(and(eq(raffleNumbers.purchaseId, child.id), eq(raffleNumbers.status, 'reserved')));
      }

      const comboChildren = await tx.select({ id: comboPurchases.id })
        .from(comboPurchases).where(eq(comboPurchases.orderId, orderId));
      for (const child of comboChildren) {
        await tx.update(comboPurchases)
          .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
          .where(and(eq(comboPurchases.id, child.id), eq(comboPurchases.paymentStatus, 'pending')));
      }

      await tx.insert(eventLogs).values({
        eventType: 'ORDER_CANCELLED',
        orderId,
        data: JSON.stringify({
          raffleChildren: raffleChildren.map((c: any) => c.id),
          comboChildren: comboChildren.map((c: any) => c.id),
        }),
      });
    });
  }

  static async confirmOrderPayment(
    orderId: string,
    paymentData: { mercadoPagoPaymentId?: string; paymentMethod?: string }
  ): Promise<{ confirmed: boolean; reason?: string }> {
    if (!this.isDbAvailable()) return { confirmed: false, reason: 'no_db' };

    // Use a wrapper object so TS control-flow analysis can track mutations inside the async tx callback
    const conflictRef: { value: { reason: string; details: object } | null } = { value: null };

    try {
      return await db.transaction(async (tx: any) => {
        const [existing] = await tx.select({ paymentStatus: orders.paymentStatus })
          .from(orders).where(eq(orders.id, orderId)).limit(1);

        if (!existing) throw new Error(`Order ${orderId} not found`);
        if (existing.paymentStatus === 'approved') return { confirmed: false, reason: 'already_approved' };

        const orderUpdate = await tx.update(orders)
          .set({
            paymentStatus: 'approved',
            mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId ?? null,
            paymentMethod: paymentData.paymentMethod ?? null,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'pending')))
          .returning({ id: orders.id });

        if (orderUpdate.length === 0) {
          conflictRef.value = { reason: 'order_not_pending', details: { orderId, currentStatus: existing.paymentStatus } };
          throw new Error(`Order ${orderId} state changed concurrently`);
        }

        const raffleChildren = await tx.select({ id: purchases.id })
          .from(purchases).where(eq(purchases.orderId, orderId));
        for (const child of raffleChildren) {
          const purchaseUpd = await tx.update(purchases)
            .set({
              paymentStatus: 'approved',
              mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId ?? null,
              paymentMethod: paymentData.paymentMethod ?? null,
              updatedAt: new Date(),
            })
            .where(and(eq(purchases.id, child.id), eq(purchases.paymentStatus, 'pending')))
            .returning({ id: purchases.id });
          if (purchaseUpd.length === 0) {
            conflictRef.value = { reason: 'raffle_child_not_pending', details: { orderId, childId: child.id } };
            throw new Error(`Raffle child ${child.id} state changed`);
          }
          const numbersUpd = await tx.update(raffleNumbers)
            .set({ status: 'sold', soldAt: new Date(), updatedAt: new Date() })
            .where(and(eq(raffleNumbers.purchaseId, child.id), eq(raffleNumbers.status, 'reserved')))
            .returning({ id: raffleNumbers.id });
          if (numbersUpd.length === 0) {
            conflictRef.value = { reason: 'no_reserved_numbers', details: { orderId, childId: child.id } };
            throw new Error(`No reserved numbers for ${child.id}`);
          }
        }

        const comboChildren = await tx.select({ id: comboPurchases.id })
          .from(comboPurchases).where(eq(comboPurchases.orderId, orderId));
        for (const child of comboChildren) {
          const upd = await tx.update(comboPurchases)
            .set({
              paymentStatus: 'approved',
              mercadoPagoPaymentId: paymentData.mercadoPagoPaymentId ?? null,
              paymentMethod: paymentData.paymentMethod ?? null,
              updatedAt: new Date(),
            })
            .where(and(eq(comboPurchases.id, child.id), eq(comboPurchases.paymentStatus, 'pending')))
            .returning({ id: comboPurchases.id });
          if (upd.length === 0) {
            conflictRef.value = { reason: 'combo_child_not_pending', details: { orderId, childId: child.id } };
            throw new Error(`Combo child ${child.id} state changed`);
          }
        }

        await tx.insert(eventLogs).values({
          eventType: 'ORDER_PAYMENT_CONFIRMED',
          orderId,
          data: JSON.stringify({ ...paymentData, raffleChildren: raffleChildren.length, comboChildren: comboChildren.length }),
        });

        return { confirmed: true };
      });
    } catch (err) {
      const c = conflictRef.value;
      if (c !== null) {
        try {
          await db.insert(eventLogs).values({
            eventType: 'ORDER_PAYMENT_CONFLICT',
            orderId,
            data: JSON.stringify({ reason: c.reason, details: c.details, paymentData }),
          });
        } catch {
          // swallow log error to surface original
        }
      }
      throw err;
    }
  }

  static async removeNumberFromOrder(
    orderId: string,
    rafflePurchaseId: string,
    numberToRemove: number,
    raffleId: number
  ): Promise<{ removed: boolean; reason?: string }> {
    if (!this.isDbAvailable()) return { removed: false, reason: 'no_db' };

    return db.transaction(async (tx: any) => {
      const [order] = await tx.select({ paymentStatus: orders.paymentStatus, totalAmount: orders.totalAmount })
        .from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { removed: false, reason: 'order_not_found' };
      if (order.paymentStatus !== 'pending') return { removed: false, reason: 'order_not_pending' };

      const [num] = await tx.select({ id: raffleNumbers.id })
        .from(raffleNumbers)
        .where(and(
          eq(raffleNumbers.raffleId, raffleId),
          eq(raffleNumbers.number, numberToRemove),
          eq(raffleNumbers.purchaseId, rafflePurchaseId),
          eq(raffleNumbers.status, 'reserved'),
        )).limit(1);
      if (!num) return { removed: false, reason: 'number_not_in_order' };

      await tx.update(raffleNumbers)
        .set({ status: 'available', reservedAt: null, purchaseId: null, updatedAt: new Date() })
        .where(and(eq(raffleNumbers.id, num.id), eq(raffleNumbers.status, 'reserved')));

      await tx.delete(purchaseNumbers).where(and(
        eq(purchaseNumbers.purchaseId, rafflePurchaseId),
        eq(purchaseNumbers.raffleNumberId, num.id),
      ));

      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, rafflePurchaseId)).limit(1);
      if (!purchase) return { removed: false, reason: 'purchase_not_found' };

      const [raffleConfig] = await tx.select().from(raffles).where(eq(raffles.id, raffleId)).limit(1);
      const decrement = raffleConfig.pricePerNumber;
      const newCount = purchase.numbersCount - 1;
      const newPurchaseTotal = purchase.totalAmount - decrement;
      const newOrderTotal = order.totalAmount - decrement;

      if (newCount === 0) {
        await tx.update(purchases)
          .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
          .where(and(eq(purchases.id, rafflePurchaseId), eq(purchases.paymentStatus, 'pending')));

        const [comboChild] = await tx.select({ totalAmount: comboPurchases.totalAmount })
          .from(comboPurchases).where(eq(comboPurchases.orderId, orderId)).limit(1);
        const totalAfterRaffleRemoved = comboChild?.totalAmount ?? 0;

        await tx.update(orders)
          .set({ hasRaffle: false, totalAmount: totalAfterRaffleRemoved, updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        if (totalAfterRaffleRemoved === 0) {
          await tx.update(orders)
            .set({ paymentStatus: 'cancelled', updatedAt: new Date() })
            .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'pending')));
        }
      } else {
        await tx.update(purchases)
          .set({ numbersCount: newCount, totalAmount: newPurchaseTotal, updatedAt: new Date() })
          .where(eq(purchases.id, rafflePurchaseId));
        await tx.update(orders)
          .set({ totalAmount: newOrderTotal, updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      }

      await tx.insert(eventLogs).values({
        eventType: 'ORDER_NUMBER_REMOVED',
        orderId,
        purchaseId: rafflePurchaseId,
        data: JSON.stringify({ numberRemoved: numberToRemove, newCount }),
      });

      return { removed: true };
    });
  }

  static async releaseExpiredOrders(): Promise<{ cancelled: number; releasedNumbers: number }> {
    if (!this.isDbAvailable()) return { cancelled: 0, releasedNumbers: 0 };

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    let cancelled = 0;
    let releasedNumbers = 0;

    const expired = await db.select({ id: orders.id })
      .from(orders)
      .where(and(
        eq(orders.paymentStatus, 'pending'),
        eq(orders.hasRaffle, true),
        lte(orders.createdAt, fifteenMinutesAgo),
      ));

    for (const order of expired) {
      const numsBefore = await db.select({ id: raffleNumbers.id })
        .from(raffleNumbers)
        .innerJoin(purchases, eq(raffleNumbers.purchaseId, purchases.id))
        .where(and(
          eq(purchases.orderId, order.id),
          eq(raffleNumbers.status, 'reserved'),
        ));
      releasedNumbers += numsBefore.length;
      await this.cancelOrder(order.id);
      cancelled++;
    }

    return { cancelled, releasedNumbers };
  }
}
