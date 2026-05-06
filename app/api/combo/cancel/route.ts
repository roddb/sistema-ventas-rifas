import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ComboService } from '@/lib/services/comboService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CancelSchema = z.object({
  comboPurchaseId: z.string().regex(/^COM-/),
  reason: z.string().max(200).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const result = await ComboService.cancelComboPayment({
      comboPurchaseId: parsed.data.comboPurchaseId,
      reason: parsed.data.reason ?? 'user_navigated_away'
    });

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    console.error('[/api/combo/cancel] error:', error);
    return NextResponse.json({ success: false, error: 'Cancel failed' }, { status: 500 });
  }
}
