import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { calculateTotal, getComboById, type CartItem } from '../combos';

const { comboPurchases, comboPurchaseItems, eventLogs } = schema;

export interface CreateComboPurchaseInput {
  buyer: { name: string; email: string; phone: string };
  items: CartItem[];
}

export class ComboService {
  static isDbAvailable(): boolean {
    return db !== null;
  }

  static async createComboPurchase(input: CreateComboPurchaseInput): Promise<{
    id: string;
    totalAmount: number;
    itemsCount: number;
    items: CartItem[];
  }> {
    if (!this.isDbAvailable()) {
      throw new Error('Database not available');
    }

    const validItems = input.items.filter((item) => {
      if (item.quantity <= 0) return false;
      return getComboById(item.comboId) !== null;
    });

    if (validItems.length === 0) {
      throw new Error('No valid items in cart');
    }

    const totalAmount = calculateTotal(validItems);
    const itemsCount = validItems.reduce((sum, item) => sum + item.quantity, 0);

    const comboPurchaseId = `COM-${nanoid(8)}`;

    return db.transaction(async (tx: any) => {
      await tx.insert(comboPurchases).values({
        id: comboPurchaseId,
        buyerName: input.buyer.name,
        email: input.buyer.email,
        phone: input.buyer.phone,
        totalAmount,
        itemsCount,
        paymentStatus: 'pending',
      });

      for (const item of validItems) {
        const combo = getComboById(item.comboId)!;
        await tx.insert(comboPurchaseItems).values({
          comboPurchaseId,
          comboId: combo.id,
          comboNameSnapshot: combo.name,
          unitPrice: combo.price,
          quantity: item.quantity,
        });
      }

      await tx.insert(eventLogs).values({
        eventType: 'COMBO_PURCHASE_CREATED',
        purchaseId: comboPurchaseId,
        data: JSON.stringify({ totalAmount, itemsCount, items: validItems }),
      });

      return {
        id: comboPurchaseId,
        totalAmount,
        itemsCount,
        items: validItems,
      };
    });
  }

  static async getComboPurchase(id: string): Promise<
    | (typeof comboPurchases.$inferSelect & {
        items: (typeof comboPurchaseItems.$inferSelect)[];
      })
    | null
  > {
    if (!this.isDbAvailable()) return null;

    const [purchase] = await db
      .select()
      .from(comboPurchases)
      .where(eq(comboPurchases.id, id))
      .limit(1);

    if (!purchase) return null;

    const items = await db
      .select()
      .from(comboPurchaseItems)
      .where(eq(comboPurchaseItems.comboPurchaseId, id));

    return { ...purchase, items };
  }

  static async setMercadoPagoPreferenceId(
    comboPurchaseId: string,
    preferenceId: string,
  ): Promise<void> {
    if (!this.isDbAvailable()) return;

    await db
      .update(comboPurchases)
      .set({
        mercadoPagoPreferenceId: preferenceId,
        updatedAt: new Date(),
      })
      .where(eq(comboPurchases.id, comboPurchaseId));
  }

  static async confirmComboPayment(params: {
    comboPurchaseId: string;
    paymentId: string;
    paymentMethod?: string;
  }): Promise<{ confirmed: boolean; reason?: string } | undefined> {
    if (!this.isDbAvailable()) return;

    return db.transaction(async (tx: any) => {
      const [current] = await tx
        .select()
        .from(comboPurchases)
        .where(eq(comboPurchases.id, params.comboPurchaseId))
        .limit(1);

      if (!current) {
        throw new Error(`Combo purchase ${params.comboPurchaseId} not found`);
      }

      if (current.paymentStatus === 'approved') {
        console.log(`[ComboService] ${params.comboPurchaseId} already approved, no-op`);
        return { confirmed: false, reason: 'already_approved' };
      }

      const result = await tx
        .update(comboPurchases)
        .set({
          paymentStatus: 'approved',
          mercadoPagoPaymentId: params.paymentId,
          paymentMethod: params.paymentMethod ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(comboPurchases.id, params.comboPurchaseId),
            eq(comboPurchases.paymentStatus, 'pending'),
          ),
        );

      if (result.rowsAffected === 0) {
        await tx.insert(eventLogs).values({
          eventType: 'COMBO_PAYMENT_CONFLICT',
          purchaseId: params.comboPurchaseId,
          data: JSON.stringify({
            purchaseId: params.comboPurchaseId,
            paymentId: params.paymentId,
            reason: 'rowsAffected=0',
          }),
        });
        return { confirmed: false, reason: 'race_lost' };
      }

      await tx.insert(eventLogs).values({
        eventType: 'COMBO_PAYMENT_CONFIRMED',
        purchaseId: params.comboPurchaseId,
        data: JSON.stringify({
          purchaseId: params.comboPurchaseId,
          paymentId: params.paymentId,
          paymentMethod: params.paymentMethod,
        }),
      });

      return { confirmed: true };
    });
  }

  static async cancelComboPayment(params: {
    comboPurchaseId: string;
    reason: string;
  }): Promise<{ cancelled: boolean; reason?: string } | undefined> {
    if (!this.isDbAvailable()) return;

    return db.transaction(async (tx: any) => {
      const result = await tx
        .update(comboPurchases)
        .set({
          paymentStatus: 'cancelled',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(comboPurchases.id, params.comboPurchaseId),
            eq(comboPurchases.paymentStatus, 'pending'),
          ),
        );

      if (result.rowsAffected === 0) {
        return { cancelled: false, reason: 'not_pending' };
      }

      await tx.insert(eventLogs).values({
        eventType: 'COMBO_PAYMENT_CANCELLED',
        purchaseId: params.comboPurchaseId,
        data: JSON.stringify({
          purchaseId: params.comboPurchaseId,
          reason: params.reason,
        }),
      });

      return { cancelled: true };
    });
  }
}
