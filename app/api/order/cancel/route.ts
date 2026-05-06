import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({ orderId: z.string().regex(/^ORD-/) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = Schema.parse(body);
    await OrderService.cancelOrder(orderId);
    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    console.error('[POST /api/order/cancel]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
