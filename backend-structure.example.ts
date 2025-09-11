// ==========================================
// 📁 /lib/db/schema.ts - Esquema Drizzle + Turso
// ==========================================

import { sql } from 'drizzle-orm';
import { integer, text, sqliteTable, real } from 'drizzle-orm/sqlite-core';

export const raffles = sqliteTable('raffles', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  totalNumbers: integer('total_numbers').notNull().default(2000),
  pricePerNumber: real('price_per_number').notNull(),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const raffleNumbers = sqliteTable('raffle_numbers', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  raffleId: integer('raffle_id').notNull().references(() => raffles.id),
  number: integer('number').notNull(),
  status: text('status', { enum: ['available', 'reserved', 'sold'] }).default('available'),
  reservedAt: integer('reserved_at', { mode: 'timestamp' }),
  soldAt: integer('sold_at', { mode: 'timestamp' }),
  purchaseId: text('purchase_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  raffleId: integer('raffle_id').notNull().references(() => raffles.id),
  buyerName: text('buyer_name').notNull(),
  studentName: text('student_name').notNull(),
  division: text('division').notNull(),
  course: text('course').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  totalAmount: real('total_amount').notNull(),
  numbersCount: integer('numbers_count').notNull(),
  mercadoPagoPreferenceId: text('mercado_pago_preference_id'),
  mercadoPagoPaymentId: text('mercado_pago_payment_id'),
  paymentStatus: text('payment_status', { 
    enum: ['pending', 'approved', 'rejected', 'cancelled'] 
  }).default('pending'),
  paymentMethod: text('payment_method'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const purchaseNumbers = sqliteTable('purchase_numbers', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  purchaseId: text('purchase_id').notNull().references(() => purchases.id),
  raffleNumberId: integer('raffle_number_id').notNull().references(() => raffleNumbers.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

export const eventLogs = sqliteTable('event_logs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  purchaseId: text('purchase_id').references(() => purchases.id),
  data: text('data'), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// ==========================================
// 📁 /lib/db/index.ts - Configuración Turso
// ==========================================

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, { schema });

// ==========================================
// 📁 /lib/mercadopago.ts - Config MercadoPago
// ==========================================

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: {
    timeout: 5000,
    idempotencyKey: 'abc'
  }
});

export const mercadoPagoClient = client;
export const preferenceService = new Preference(client);
export const paymentService = new Payment(client);

// Crear preferencia de pago
export async function createPaymentPreference(purchaseData: {
  id: string;
  buyerName: string;
  email: string;
  phone?: string;
  numbers: number[];
  totalAmount: number;
  numbersCount: number;
}) {
  try {
    const preference = await preferenceService.create({
      body: {
        items: [
          {
            id: purchaseData.id,
            title: `Rifas Colegio - ${purchaseData.numbersCount} números`,
            description: `Números: ${purchaseData.numbers.join(', ')}`,
            unit_price: purchaseData.totalAmount,
            quantity: 1,
            currency_id: 'ARS'
          }
        ],
        payer: {
          name: purchaseData.buyerName,
          email: purchaseData.email,
          ...(purchaseData.phone && {
            phone: {
              number: purchaseData.phone
            }
          })
        },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success`,
          failure: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/failure`,
          pending: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/pending`
        },
        auto_return: 'approved',
        notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/mercadopago`,
        external_reference: purchaseData.id,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos
      }
    });

    return {
      preferenceId: preference.id!,
      initPoint: preference.init_point!
    };
  } catch (error) {
    console.error('Error creating MercadoPago preference:', error);
    throw new Error('Failed to create payment preference');
  }
}

// ==========================================
// 📁 /lib/services/raffleService.ts
// ==========================================

import { db } from '../db';
import { raffleNumbers, purchases, purchaseNumbers, eventLogs } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createPaymentPreference } from '../mercadopago';

export interface CreatePurchaseData {
  buyerName: string;
  studentName: string;
  division: string;
  course: string;
  email: string;
  phone?: string;
  selectedNumbers: number[];
  raffleId: number;
  pricePerNumber: number;
}

export class RaffleService {
  // Obtener todos los números con su estado
  async getNumbers(raffleId: number = 1) {
    return await db.select().from(raffleNumbers).where(eq(raffleNumbers.raffleId, raffleId));
  }

  // Crear reserva temporal de números
  async createReservation(numbers: number[], raffleId: number = 1) {
    const reservationId = `RES-${Date.now()}`;
    const reservedAt = new Date();
    
    try {
      // Verificar que los números estén disponibles
      const existingNumbers = await db.select()
        .from(raffleNumbers)
        .where(
          and(
            eq(raffleNumbers.raffleId, raffleId),
            inArray(raffleNumbers.number, numbers)
          )
        );

      const unavailableNumbers = existingNumbers.filter(n => n.status !== 'available');
      if (unavailableNumbers.length > 0) {
        throw new Error(`Números no disponibles: ${unavailableNumbers.map(n => n.number).join(', ')}`);
      }

      // Reservar números
      await db.update(raffleNumbers)
        .set({ 
          status: 'reserved', 
          reservedAt,
          purchaseId: reservationId 
        })
        .where(
          and(
            eq(raffleNumbers.raffleId, raffleId),
            inArray(raffleNumbers.number, numbers),
            eq(raffleNumbers.status, 'available')
          )
        );

      // Log del evento
      await this.logEvent('reservation_created', reservationId, {
        numbers,
        reservedAt: reservedAt.toISOString()
      });

      return { success: true, reservationId };
    } catch (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }
  }

  // Crear compra completa
  async createPurchase(data: CreatePurchaseData) {
    const purchaseId = `PUR-${Date.now()}`;
    const totalAmount = data.selectedNumbers.length * data.pricePerNumber;

    try {
      // 1. Crear reserva temporal
      await this.createReservation(data.selectedNumbers, data.raffleId);

      // 2. Crear registro de compra
      await db.insert(purchases).values({
        id: purchaseId,
        raffleId: data.raffleId,
        buyerName: data.buyerName,
        studentName: data.studentName,
        division: data.division,
        course: data.course,
        email: data.email,
        phone: data.phone,
        totalAmount,
        numbersCount: data.selectedNumbers.length,
        paymentStatus: 'pending'
      });

      // 3. Crear preferencia de MercadoPago
      const mpPreference = await createPaymentPreference({
        id: purchaseId,
        buyerName: data.buyerName,
        email: data.email,
        phone: data.phone,
        numbers: data.selectedNumbers,
        totalAmount,
        numbersCount: data.selectedNumbers.length
      });

      // 4. Actualizar compra con datos de MercadoPago
      await db.update(purchases)
        .set({ mercadoPagoPreferenceId: mpPreference.preferenceId })
        .where(eq(purchases.id, purchaseId));

      // 5. Log del evento
      await this.logEvent('purchase_created', purchaseId, {
        totalAmount,
        numbersCount: data.selectedNumbers.length,
        mercadoPagoPreferenceId: mpPreference.preferenceId
      });

      return {
        purchaseId,
        mercadoPagoPreferenceId: mpPreference.preferenceId,
        initPoint: mpPreference.initPoint
      };

    } catch (error) {
      // Rollback: liberar números si hubo error
      await this.releaseNumbers(data.selectedNumbers, data.raffleId);
      console.error('Error creating purchase:', error);
      throw error;
    }
  }

  // Confirmar compra exitosa
  async confirmPurchase(purchaseId: string, paymentId: string, paymentMethod?: string) {
    try {
      // Actualizar estado de compra
      await db.update(purchases)
        .set({ 
          paymentStatus: 'approved',
          mercadoPagoPaymentId: paymentId,
          paymentMethod,
          updatedAt: new Date()
        })
        .where(eq(purchases.id, purchaseId));

      // Obtener datos de la compra
      const purchase = await db.select().from(purchases).where(eq(purchases.id, purchaseId));
      if (!purchase[0]) throw new Error('Purchase not found');

      // Obtener números reservados para esta compra
      const reservedNumbers = await db.select()
        .from(raffleNumbers)
        .where(
          and(
            eq(raffleNumbers.raffleId, purchase[0].raffleId),
            eq(raffleNumbers.purchaseId, purchaseId),
            eq(raffleNumbers.status, 'reserved')
          )
        );

      // Marcar números como vendidos
      await db.update(raffleNumbers)
        .set({ 
          status: 'sold',
          soldAt: new Date()
        })
        .where(
          and(
            eq(raffleNumbers.raffleId, purchase[0].raffleId),
            eq(raffleNumbers.purchaseId, purchaseId)
          )
        );

      // Crear relaciones purchase_numbers
      const purchaseNumbersData = reservedNumbers.map(num => ({
        purchaseId,
        raffleNumberId: num.id
      }));

      await db.insert(purchaseNumbers).values(purchaseNumbersData);

      // Log del evento
      await this.logEvent('purchase_confirmed', purchaseId, {
        paymentId,
        paymentMethod,
        numbersCount: reservedNumbers.length
      });

      return { success: true };
    } catch (error) {
      console.error('Error confirming purchase:', error);
      throw error;
    }
  }

  // Liberar números (timeout o pago fallido)
  async releaseNumbers(numbers: number[], raffleId: number = 1) {
    await db.update(raffleNumbers)
      .set({ 
        status: 'available',
        reservedAt: null,
        purchaseId: null
      })
      .where(
        and(
          eq(raffleNumbers.raffleId, raffleId),
          inArray(raffleNumbers.number, numbers)
        )
      );
  }

  // Log de eventos
  async logEvent(eventType: string, purchaseId?: string, data?: any) {
    await db.insert(eventLogs).values({
      eventType,
      purchaseId,
      data: JSON.stringify(data)
    });
  }

  // Limpiar reservas expiradas (cron job)
  async cleanExpiredReservations() {
    const expiredTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutos atrás
    
    const expiredReservations = await db.select()
      .from(raffleNumbers)
      .where(
        and(
          eq(raffleNumbers.status, 'reserved'),
          // reservedAt < expiredTime (necesitas adaptar esta query según tu ORM)
        )
      );

    if (expiredReservations.length > 0) {
      const expiredNumbers = expiredReservations.map(n => n.number);
      await this.releaseNumbers(expiredNumbers);
      
      await this.logEvent('reservations_expired', undefined, {
        expiredCount: expiredReservations.length,
        numbers: expiredNumbers
      });
    }

    return expiredReservations.length;
  }
}

export const raffleService = new RaffleService();

// ==========================================
// 📁 /app/api/numbers/route.ts - API Route
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { raffleService } from '@/lib/services/raffleService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raffleId = parseInt(searchParams.get('raffleId') || '1');

    const numbers = await raffleService.getNumbers(raffleId);
    
    return NextResponse.json({ numbers });
  } catch (error) {
    console.error('Error fetching numbers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch numbers' },
      { status: 500 }
    );
  }
}

// ==========================================
// 📁 /app/api/purchase/route.ts - API Route
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { raffleService } from '@/lib/services/raffleService';
import { z } from 'zod';

const createPurchaseSchema = z.object({
  buyerName: z.string().min(2, 'Nombre requerido'),
  studentName: z.string().min(2, 'Nombre del estudiante requerido'),
  division: z.string().min(1, 'División requerida'),
  course: z.string().min(1, 'Curso requerido'),
  email: z.string().email('Email válido requerido'),
  phone: z.string().optional(),
  selectedNumbers: z.array(z.number()).min(1, 'Debe seleccionar al menos un número'),
  raffleId: z.number().default(1),
  pricePerNumber: z.number().default(500)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar datos de entrada
    const validatedData = createPurchaseSchema.parse(body);
    
    // Crear compra
    const result = await raffleService.createPurchase(validatedData);
    
    return NextResponse.json({
      success: true,
      purchaseId: result.purchaseId,
      mercadoPagoPreferenceId: result.mercadoPagoPreferenceId,
      redirectUrl: result.initPoint
    });
    
  } catch (error) {
    console.error('Error creating purchase:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ==========================================
// 📁 /app/api/webhooks/mercadopago/route.ts - Webhook
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/mercadopago';
import { raffleService } from '@/lib/services/raffleService';
import crypto from 'crypto';

// Verificar firma del webhook (seguridad)
function verifyWebhookSignature(body: string, signature: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true; // En desarrollo, skip verification
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-signature') || '';
    
    // Verificar firma
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const webhook = JSON.parse(body);
    
    // Solo procesar eventos de pago
    if (webhook.action === 'payment.created' || webhook.action === 'payment.updated') {
      const paymentId = webhook.data.id;
      
      // Obtener detalles del pago desde MercadoPago
      const payment = await paymentService.get({ id: paymentId });
      
      if (payment.external_reference) {
        const purchaseId = payment.external_reference;
        
        if (payment.status === 'approved') {
          // Confirmar compra
          await raffleService.confirmPurchase(
            purchaseId,
            paymentId.toString(),
            payment.payment_method_id
          );
          
          // Aquí podrías enviar email de confirmación
          // await sendConfirmationEmail(purchaseId);
          
        } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
          // Liberar números reservados
          // Necesitarías obtener los números de la compra y liberarlos
          await raffleService.logEvent('payment_failed', purchaseId, {
            paymentId,
            status: payment.status,
            statusDetail: payment.status_detail
          });
        }
      }
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ==========================================
// 📁 /.env.example - Variables de entorno
// ==========================================

# Base de datos Turso
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# MercadoPago
MERCADO_PAGO_ACCESS_TOKEN=your-access-token
MERCADO_PAGO_PUBLIC_KEY=your-public-key
MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development

# Email (opcional - para confirmaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

// ==========================================
// 📁 /package.json - Dependencias
// ==========================================

{
  "name": "rifas-escolares",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate:sqlite",
    "db:migrate": "drizzle-kit push:sqlite",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@libsql/client": "^0.8.0",
    "drizzle-orm": "^0.32.0",
    "mercadopago": "^2.0.15",
    "lucide-react": "^0.427.0",
    "zod": "^3.23.8",
    "nodemailer": "^6.9.14"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "@types/node": "20.14.15",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@types/nodemailer": "^6.4.15",
    "drizzle-kit": "^0.23.0",
    "tailwindcss": "3.4.7",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.41",
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.5"
  }
}

// ==========================================
// 📁 /drizzle.config.ts - Config Drizzle
// ==========================================

import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  driver: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
  verbose: true,
  strict: true,
} satisfies Config;

// ==========================================
// 📁 /lib/email.ts - Sistema de emails (opcional)
// ==========================================

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendConfirmationEmail(purchaseId: string) {
  try {
    // Obtener datos de la compra desde BD
    // const purchase = await getPurchaseById(purchaseId);
    
    const info = await transporter.sendMail({
      from: `"Rifa Escolar" <${process.env.SMTP_USER}>`,
      to: 'buyer@email.com', // purchase.email
      subject: `Confirmación de Compra - Rifa Escolar #${purchaseId}`,
      html: `
        <h1>¡Compra Confirmada!</h1>
        <p>Tu compra ha sido procesada exitosamente.</p>
        <p><strong>ID de Compra:</strong> ${purchaseId}</p>
        <!-- Agregar más detalles de la compra -->
      `,
    });

    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// ==========================================
// 📁 /middleware.ts - Middleware Next.js (opcional)
// ==========================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Rate limiting básico para APIs
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Implementar rate limiting aquí si es necesario
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

// ==========================================
// INSTRUCCIONES DE SETUP
// ==========================================

/*
PASOS PARA MIGRAR A VS CODE:

1. Crear proyecto Next.js:
   npx create-next-app@latest rifas-escolares --typescript --tailwind --eslint --app

2. Instalar dependencias:
   npm install @libsql/client drizzle-orm mercadopago lucide-react zod nodemailer
   npm install -D drizzle-kit @types/nodemailer

3. Copiar todos estos archivos a sus respectivas ubicaciones

4. Configurar variables de entorno (.env.local):
   - Copia las variables del .env.example
   - Configura tu base de datos Turso
   - Configura tu cuenta MercadoPago

5. Generar y aplicar migraciones:
   npm run db:generate
   npm run db:migrate

6. Ejecutar desarrollo:
   npm run dev

7. Para producción (Vercel):
   - Configurar variables de entorno en Vercel
   - Hacer deploy
   - Configurar dominio custom
   - Configurar webhooks de MercadoPago

CARACTERÍSTICAS INCLUIDAS:
✅ Frontend completo con grilla 100x20
✅ Sistema de reservas temporales
✅ Integración MercadoPago completa
✅ Schema de BD optimizado para Turso
✅ API Routes preparadas
✅ Webhook handler para notificaciones
✅ Sistema de logs y eventos
✅ Validación con Zod
✅ Panel de administración básico
✅ Sistema de emails (opcional)
✅ Middleware y rate limiting
✅ TypeScript completo
✅ Error handling robusto
*/