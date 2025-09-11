import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const collectionId = searchParams.get('collection_id');
  const collectionStatus = searchParams.get('collection_status');
  const paymentId = searchParams.get('payment_id');
  const status = searchParams.get('status');
  const externalReference = searchParams.get('external_reference');
  const paymentType = searchParams.get('payment_type');
  const merchantOrderId = searchParams.get('merchant_order_id');
  const preferenceId = searchParams.get('preference_id');

  console.log('Payment pending callback received:', {
    collectionId,
    collectionStatus,
    paymentId,
    status,
    externalReference,
    paymentType,
    merchantOrderId,
    preferenceId
  });

  // Redirigir al frontend con el estado pendiente
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas.vercel.app';
  const redirectUrl = new URL(baseUrl);
  redirectUrl.searchParams.set('payment', 'pending');
  redirectUrl.searchParams.set('purchase', externalReference || '');
  redirectUrl.searchParams.set('payment_id', paymentId || '');
  
  return NextResponse.redirect(redirectUrl);
}