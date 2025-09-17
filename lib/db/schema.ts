import { sql } from 'drizzle-orm';
import { integer, text, sqliteTable, real } from 'drizzle-orm/sqlite-core';

export const raffles = sqliteTable('raffles', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  totalNumbers: integer('total_numbers').notNull().default(1500),
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