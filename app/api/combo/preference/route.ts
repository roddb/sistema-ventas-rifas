import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ComboService } from '@/lib/services/comboService';
import { createComboPreference } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PreferenceSchema = z.object({
  comboPurchaseId: z.string().regex(/^COM-/)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PreferenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const purchase = await ComboService.getComboPurchase(parsed.data.comboPurchaseId);
    if (!purchase) {
      return NextResponse.json(
        { success: false, error: 'Combo purchase not found' },
        { status: 404 }
      );
    }

    if (purchase.paymentStatus !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot create preference for ${purchase.paymentStatus} purchase` },
        { status: 409 }
      );
    }

    const items = purchase.items.map((item) => ({
      id: item.comboId,
      name: item.comboNameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }));

    const mpResult = await createComboPreference({
      comboPurchaseId: purchase.id,
      buyerName: purchase.buyerName,
      email: purchase.email,
      items,
      totalAmount: purchase.totalAmount
    });

    await ComboService.setMercadoPagoPreferenceId(purchase.id, mpResult.preferenceId);

    return NextResponse.json(
      {
        success: true,
        initPoint: mpResult.initPoint,
        sandboxInitPoint: mpResult.sandboxInitPoint,
        preferenceId: mpResult.preferenceId
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      }
    );
  } catch (error) {
    console.error('[/api/combo/preference] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create preference' },
      { status: 503 }
    );
  }
}
