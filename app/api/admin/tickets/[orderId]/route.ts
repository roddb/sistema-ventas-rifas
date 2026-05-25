import { NextRequest, NextResponse } from 'next/server';
import { getOrderForTicket } from '@/lib/tickets/queries';
import { renderHoja } from '@/lib/tickets/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const data = await getOrderForTicket(params.orderId);
    if (!data) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px"><h1>404</h1><p>Order ${params.orderId} no encontrada o no approved.</p></body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const html = renderHoja(data);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[admin/tickets/[orderId]] error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
