# Allo Inventory Reservation System

Inventory reservation app for a multi-warehouse checkout flow.

Live demo: https://inventory-reservation-system-slk4.vercel.app/

## Overview

This app reserves stock for a short period while a customer is checking out. If payment is confirmed, the reservation is finalized. If the payment fails, the user cancels, or the hold expires, the stock is released back to inventory.

## Features

- Catalog view with stock by warehouse
- Reservation flow with a 10-minute hold window
- Reservation detail page with confirm and release actions
- Automatic cleanup for expired reservations
- Idempotent reservation requests
- Seeded demo data for testing right away

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- Upstash Redis
- Zod
- Tailwind CSS
- Jest

## Project Structure

- `src/app` - routes, pages, and API handlers
- `src/components` - reusable UI components
- `src/lib` - inventory logic, API helpers, formatting, Prisma client
- `src/schemas` - request validation schemas
- `prisma` - schema, migrations, and seed script

## Local Setup

1. Install dependencies.

```bash
cd allo-inventory
npm install
```

2. Create a local env file.

Copy `.env.example` to `.env.local` and fill in your values.

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/dbname"
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
CRON_SECRET="your-random-secret-string"
```

3. Generate the Prisma client.

```bash
npm run prisma:generate
```

4. Run migrations.

```bash
npm run prisma:migrate
```

5. Seed the database.

```bash
npm run seed
```

6. Start the app.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production server locally
- `npm run lint` - run ESLint
- `npm test` - run Jest tests
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - run Prisma migrations
- `npm run seed` - load sample data

## API Routes

- `GET /api/products`
- `GET /api/warehouses`
- `POST /api/reservations`
- `GET /api/reservations/:id`
- `POST /api/reservations/:id/confirm`
- `POST /api/reservations/:id/release`
- `GET /api/cron/cleanup`

## Notes

- Reservation availability is derived from stock data, not stored as a separate field.
- Expired reservations are cleaned up by a cron endpoint.
- The app uses database row locking for reservation creation so two users cannot reserve the same last unit at the same time.
- `.env`, `.env.local`, `node_modules`, and `.next` are ignored and not part of the repository.

## Deployment

The app is deployed on Vercel.

If you deploy it again, make sure these environment variables are set in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`

The repo also includes a GitHub Actions workflow for cleanup scheduling on Hobby plans.
