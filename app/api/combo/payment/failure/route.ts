import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const externalRef = url.searchParams.get('external_reference') ?? '';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
  const redirect = new URL(baseUrl);
  redirect.searchParams.set('combo', 'failure');
  redirect.searchParams.set('order', externalRef);

  return NextResponse.redirect(redirect.toString());
}
