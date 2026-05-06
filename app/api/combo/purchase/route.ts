import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ComboService } from '@/lib/services/comboService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PurchaseSchema = z.object({
  buyer: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().min(5).max(30)
  }),
  items: z.array(z.object({
    comboId: z.string().min(1),
    quantity: z.number().int().min(1).max(50)
  })).min(1).max(20)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PurchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await ComboService.createComboPurchase(parsed.data);

    return NextResponse.json(
      {
        success: true,
        comboPurchaseId: result.id,
        totalAmount: result.totalAmount,
        itemsCount: result.itemsCount
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      }
    );
  } catch (error) {
    console.error('[/api/combo/purchase] error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
