import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('external_reference') ?? '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  return NextResponse.redirect(`${baseUrl}/?payment=failure&order=${orderId}`);
}
