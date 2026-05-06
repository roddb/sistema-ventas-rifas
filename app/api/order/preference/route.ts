import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createOrderPreference } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({ orderId: z.string().regex(/^ORD-/) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = Schema.parse(body);

    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (order.paymentStatus !== 'pending') {
      return NextResponse.json({ success: false, error: 'Order not pending' }, { status: 409 });
    }

    let raffleData: { title: string; numbers: number[]; pricePerNumber: number } | undefined;
    if (order.hasRaffle) {
      const [purchase] = await db.select().from(schema.purchases).where(eq(schema.purchases.orderId, orderId)).limit(1);
      if (!purchase) throw new Error(`Raffle child not found for order ${orderId}`);
      const nums = await db.select({ raffleNumberId: schema.purchaseNumbers.raffleNumberId })
        .from(schema.purchaseNumbers).where(eq(schema.purchaseNumbers.purchaseId, purchase.id));
      const numbers = await Promise.all(nums.map(async (pn: { raffleNumberId: number }) => {
        const [rn] = await db.select({ number: schema.raffleNumbers.number })
          .from(schema.raffleNumbers).where(eq(schema.raffleNumbers.id, pn.raffleNumberId)).limit(1);
        return rn.number;
      }));
      const [raffle] = await db.select().from(schema.raffles).where(eq(schema.raffles.id, purchase.raffleId)).limit(1);
      raffleData = { title: raffle.title, numbers: numbers.sort((a, b) => a - b), pricePerNumber: raffle.pricePerNumber };
    }

    let comboData: { id: string; name: string; quantity: number; unitPrice: number }[] | undefined;
    if (order.hasCombos) {
      const [comboPurchase] = await db.select().from(schema.comboPurchases).where(eq(schema.comboPurchases.orderId, orderId)).limit(1);
      if (!comboPurchase) throw new Error(`Combo child not found for order ${orderId}`);
      const items = await db.select().from(schema.comboPurchaseItems).where(eq(schema.comboPurchaseItems.comboPurchaseId, comboPurchase.id));
      comboData = items.map((it: { comboId: string; comboNameSnapshot: string; quantity: number; unitPrice: number }) => ({
        id: it.comboId,
        name: `${it.comboNameSnapshot} (combo)`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));
    }

    const preference = await createOrderPreference({
      orderId,
      buyer: { name: order.buyerName, email: order.email },
      raffle: raffleData,
      combos: comboData,
    });

    await db.update(schema.orders)
      .set({ mercadoPagoPreferenceId: preference.preferenceId, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));

    return NextResponse.json({ success: true, data: preference }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    console.error('[POST /api/order/preference]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 503 });
  }
}
