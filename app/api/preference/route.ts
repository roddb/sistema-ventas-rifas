import { NextResponse } from 'next/server';
import { createPaymentPreference } from '@/lib/mercadopago';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createPreferenceSchema = z.object({
  purchaseId: z.string().min(1),
  buyerName: z.string().min(1),
  email: z.string().email(),
  numbers: z.array(z.number()).min(1),
  totalAmount: z.number().positive()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Create preference request:', body);
    
    // Validar datos
    const data = createPreferenceSchema.parse(body);
    
    // Crear preferencia en MercadoPago
    const preference = await createPaymentPreference(data);
    
    console.log('Preference created successfully:', preference);
    
    return NextResponse.json({
      success: true,
      ...preference
    });
  } catch (error) {
    console.error('Error creating preference:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create payment preference' },
      { status: 500 }
    );
  }
}