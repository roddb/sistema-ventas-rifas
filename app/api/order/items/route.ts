import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({
  orderId: z.string().regex(/^ORD-/),
  rafflePurchaseId: z.string().regex(/^PUR-/),
  raffleId: z.number().int().positive(),
  number: z.number().int().positive(),
});

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, rafflePurchaseId, raffleId, number } = Schema.parse(body);
    const result = await OrderService.removeNumberFromOrder(orderId, rafflePurchaseId, number, raffleId);
    if (!result.removed) {
      return NextResponse.json({ success: false, error: result.reason ?? 'unknown' }, { status: 409 });
    }
    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    console.error('[DELETE /api/order/items]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
