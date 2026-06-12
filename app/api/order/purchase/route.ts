import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Schema = z.object({
  buyer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    studentName: z.string().optional(),
    division: z.string().optional(),
    course: z.string().optional(),
  }),
  raffle: z.object({
    raffleId: z.number().int().positive(),
    numberIds: z.array(z.number().int().positive()).min(1),
  }).optional(),
  combos: z.array(z.object({
    comboId: z.string(),
    quantity: z.number().int().positive().max(50),
    flavors: z.object({
      carne: z.number().int().min(0),
      jyq: z.number().int().min(0),
    }).optional(),
  })).optional(),
}).refine((d) => d.raffle || d.combos, { message: 'At least raffle or combos required' });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.parse(body);

    if (parsed.raffle && (!parsed.buyer.studentName || !parsed.buyer.division || !parsed.buyer.course)) {
      return NextResponse.json({ success: false, error: 'Datos del estudiante requeridos cuando hay rifa' }, { status: 400 });
    }

    const result = await OrderService.createOrder(parsed);
    return NextResponse.json({ success: true, data: result }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: e.errors }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('no disponible')) {
      return NextResponse.json({ success: false, error: msg }, { status: 409 });
    }
    if (msg.includes('empanadas por gusto')) {
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    console.error('[POST /api/order/purchase]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
