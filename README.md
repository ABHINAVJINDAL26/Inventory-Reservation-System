# Allo Inventory Reservation System

Reservation-first inventory management for multi-warehouse commerce.

## Project Overview

This is an inventory reservation system for multi-warehouse retail and D2C brands. The point is to avoid overselling during slow payment flows while also avoiding fake stock depletion during cart abandonment.

The flow is:

- A customer reaches checkout.
- Stock is reserved for a short window instead of being decremented immediately.
- If payment succeeds, the reservation is confirmed.
- If payment fails or the hold expires, stock is released back to availability.

The exercise is intentionally about correctness under concurrency, so the reservation logic is the main focus of the app.

## Provider Choice

This workspace is set up for:

- Supabase for hosted Postgres
- Upstash for Redis

I still need the real connection strings/tokens from you before the app can talk to live services.

## Design Notes

The UI is built dark-first with glassy cards, color-coded status states, and a monospace countdown timer on the reservation page.

- Primary background: slate navy
- Accent: indigo
- Success: green
- Warning: amber
- Danger: red

The frontend is intentionally simple and direct so the reservation flow is easy to follow.

## What It Does

This app models the core checkout reservation flow from the take-home exercise:

- Products are stocked per warehouse.
- Checkout creates a temporary reservation hold for 10 minutes.
- Payment success confirms the reservation and permanently decrements stock.
- Payment failure or cancellation releases the hold early.
- Expired reservations are cleaned up automatically by a Vercel Cron job.

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma + PostgreSQL
- Upstash Redis for idempotency
- Zod for request validation
- Tailwind CSS for UI styling

## Data Model

The app uses four main concepts:

- `Product`
- `Warehouse`
- `Stock`
- `Reservation`

The important rule is:

- `availableUnits = totalUnits - reserved`

That value is computed in queries instead of being stored separately, which keeps inventory state consistent.

## API Surface

The app exposes these endpoints:

- `GET /api/products`
- `GET /api/warehouses`
- `POST /api/reservations`
- `POST /api/reservations/:id/confirm`
- `POST /api/reservations/:id/release`
- `GET /api/reservations/:id`
- `GET /api/cron/cleanup`

The reservation creation path uses a PostgreSQL row lock with `FOR UPDATE` so two requests racing for the final unit cannot both succeed.

## Frontend Pages

The app has two user-facing pages:

- Product listing page at `/`
- Reservation page at `/reservation/:id`

The listing page shows products, stock per warehouse, and a reserve action. The reservation page shows the hold details, live countdown, confirm button, and cancel button.

The page state updates locally after confirm or release, so the user does not need to refresh.

## Local Setup

### 1. Install dependencies

```bash
cd allo-inventory
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/dbname"
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
CRON_SECRET="your-random-secret-string"
```

You need to paste the real values from:

- Supabase Database Settings for `DATABASE_URL` and `DIRECT_URL`
- Upstash Redis Console for `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Any secure random string for `CRON_SECRET`

### 3. Generate Prisma client

```bash
npx prisma generate
```

### 4. Run migrations

```bash
npx prisma migrate dev --name init
```

### 5. Seed sample data

```bash
npm run seed
```

### 6. Start the app

```bash
npm run dev
```

Open http://localhost:3000.

## Deployment Notes

- The app is meant to be deployed on Vercel.
- PostgreSQL should be hosted on Supabase or an equivalent managed provider.
- Redis should be hosted on Upstash.
- Expired reservations are cleaned by Vercel Cron every 2 minutes.

## Validation

```bash
npm run lint
npm run build
```

## API

- `GET /api/products` returns products with per-warehouse available stock.
- `GET /api/warehouses` returns warehouse metadata.
- `POST /api/reservations` creates a reservation hold.
- `POST /api/reservations/:id/confirm` confirms a reservation.
- `POST /api/reservations/:id/release` releases a reservation early.
- `GET /api/reservations/:id` returns the reservation state for the checkout page.
- `GET /api/cron/cleanup` releases expired reservations.

The reservation endpoint is concurrency-safe by locking the stock row inside a PostgreSQL transaction with `FOR UPDATE`. If two requests race for the last unit, exactly one succeeds and the other gets `409`.

## Expiry Mechanism

Production expiry is handled by a Vercel Cron job configured in `vercel.json`.

- The cron hits `/api/cron/cleanup` every 2 minutes.
- The endpoint finds pending reservations where `expiresAt < now()`.
- Each expired reservation is released inside a transaction.
- The stock row is updated so the released units become available again.

The app pages are marked `force-dynamic`, so local builds do not try to prerender them against a missing database.

## Bonus: Idempotency

The reserve and confirm endpoints accept `Idempotency-Key`.

- If the key already exists in Redis, the original response is returned.
- Otherwise the request is processed and cached for 24 hours.

This makes retries safe when the client repeats a request after a timeout or connection issue.

## Idempotency

The `reserve` and `confirm` endpoints accept `Idempotency-Key`.

- The key is checked in Upstash Redis.
- If a matching response already exists, the original response is returned.
- If not, the request is processed and the response is cached for 24 hours.

## Trade-Offs

- I used PostgreSQL row locking rather than Redis distributed locks for the reservation race, because the stock row itself is the source of truth.
- The UI countdown is client-side only; it updates the current reservation view without WebSockets or SSE.
- Expiry is cron-driven instead of a background worker because it fits Vercel deployment better.
- I left admin tooling, WebSocket stock sync, and broader rate limiting out to keep the scope focused.

## What Was Left Out

With more time, I would add:

- WebSocket or SSE stock updates
- Admin dashboard for inventory and reservation monitoring
- Rate limiting on reservation endpoints
- Email or notification reminders before expiry
- More complete E2E and concurrency tests

## Seed Data

The seed script creates:

- 3 warehouses
- 5 products
- stock rows for every product/warehouse pair

The product catalog is intentionally non-empty so the demo flow works immediately after seeding.

## Testing

The repo currently validates with:

- `npm run lint`
- `npm run build`

For a fuller suite, I would add unit tests for the reservation service and a concurrency test that proves exactly one of two competing reservations for the last unit succeeds.
