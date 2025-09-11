# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a school raffle ticket sales system with Next.js frontend, Drizzle ORM + Turso database, and MercadoPago payment integration. The system manages 2000 raffle numbers with reservation/purchase flow.

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript, React 18, Tailwind CSS
- **Database**: Turso (SQLite edge database) with Drizzle ORM
- **Payments**: MercadoPago integration
- **Hosting**: Designed for Vercel deployment

## Key Architecture Components

### Database Schema (Drizzle + Turso)
- `raffles`: Main raffle configuration
- `raffle_numbers`: Individual number status tracking (available/reserved/sold)
- `purchases`: Purchase records with buyer information
- `purchase_numbers`: Many-to-many relationship between purchases and numbers
- `event_logs`: Audit trail for all system events

### Core Services
- **RaffleService** (`/lib/services/raffleService.ts`): Main business logic handling number reservations, purchases, and payment confirmations
- **MercadoPago Integration** (`/lib/mercadopago.ts`): Payment preference creation and webhook handling
- **API Routes**: RESTful endpoints for numbers, purchases, and payment webhooks

### Frontend Components
- **RifasApp**: Main React component with complete UI flow
- **Number Grid**: 100x20 grid visualization (2000 numbers total)
- **Multi-step purchase flow**: Selection → Form → Payment → Confirmation
- **Admin Panel**: Sales metrics and purchase tracking

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Database migrations
npm run db:generate    # Generate Drizzle migrations
npm run db:migrate     # Apply migrations to Turso
npm run db:studio      # Open Drizzle Studio for DB management

# Build for production
npm run build

# Linting
npm run lint
```

## Environment Variables

Required in `.env.local`:
```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
MERCADO_PAGO_ACCESS_TOKEN=your-mp-token
MERCADO_PAGO_PUBLIC_KEY=your-mp-public-key
MERCADO_PAGO_WEBHOOK_SECRET=webhook-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Critical Business Logic

### Number Reservation Flow
1. Numbers are temporarily reserved (15-minute timeout)
2. Purchase record created with pending status
3. MercadoPago preference generated for payment
4. On successful payment: numbers marked as sold
5. On timeout/failure: numbers released back to available pool

### Payment Integration
- Webhook endpoint at `/api/webhooks/mercadopago` processes payment notifications
- Automatic status updates based on MercadoPago payment events
- Signature verification for webhook security

### State Management
- Number statuses: `available`, `reserved`, `sold`
- Purchase statuses: `pending`, `approved`, `rejected`, `cancelled`
- Real-time UI updates reflect current number availability

## Project Structure

```
/app                    # Next.js app directory
  /api                  # API routes
    /numbers            # Get raffle numbers
    /purchase           # Create purchase
    /webhooks           # Payment webhooks
/lib                    # Core libraries
  /db                   # Database schema and config
  /services             # Business logic services
  /mercadopago.ts       # Payment integration
```

## Testing Approach

The codebase includes simulation features for development:
- Mock API responses in frontend (`apiService`)
- Payment simulation buttons in demo mode
- Configurable timeout for reservation testing

For production testing:
- Use MercadoPago sandbox environment
- Test webhook integration with real payment flow
- Verify reservation timeout cleanup