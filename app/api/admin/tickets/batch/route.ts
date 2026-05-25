import { NextRequest, NextResponse } from 'next/server';
import { getAllApprovedOrderIds, getOrderForTicket, type OrderTicketData } from '@/lib/tickets/queries';
import { renderBatch } from '@/lib/tickets/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const courseFilter = req.nextUrl.searchParams.get('course');
    const divisionFilter = req.nextUrl.searchParams.get('division');

    const orderIds = await getAllApprovedOrderIds();
    const allResults = await Promise.all(orderIds.map((id) => getOrderForTicket(id)));

    let filtered: OrderTicketData[] = allResults.filter(
      (r): r is OrderTicketData => r !== null
    );

    if (courseFilter) {
      filtered = filtered.filter((d) => d.family.course === courseFilter);
    }
    if (divisionFilter) {
      filtered = filtered.filter((d) => d.family.division === divisionFilter);
    }

    const html = renderBatch(filtered);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[admin/tickets/batch] error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
