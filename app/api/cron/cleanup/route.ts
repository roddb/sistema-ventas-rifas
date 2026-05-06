import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '@/lib/services/orderService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await OrderService.releaseExpiredOrders();
    console.log('Cleanup completed:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('[Cron cleanup] error:', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
