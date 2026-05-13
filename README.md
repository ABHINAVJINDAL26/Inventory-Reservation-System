# Allo Inventory Reservation System

A reservation-first inventory system for multi-warehouse commerce. This project holds stock temporarily during slow payment flows so the same unit is not sold twice, while also avoiding false stock depletion from abandoned carts.

## What this app does

The core flow is:

1. A customer starts checkout.
2. The app creates a temporary reservation for the requested units.
3. If payment succeeds, the reservation is confirmed.
4. If payment fails, the user cancels, or the hold expires, the stock is released back to availability.

The assignment focuses on correctness under concurrency, predictable expiry, and a clean user experience.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- Upstash Redis
- Zod
- Tailwind CSS

## Key domain rule

The app never stores available stock as a separate persisted field.

```text
availableUnits = totalUnits - reserved
```

That keeps the system consistent and avoids drift between derived and stored values.

## Important API routes

- `GET /api/products`
- `GET /api/warehouses`
- `POST /api/reservations`
- `GET /api/reservations/:id`
- `POST /api/reservations/:id/confirm`
- `POST /api/reservations/:id/release`
- `GET /api/cron/cleanup`

Reservation creation uses a PostgreSQL transaction with row locking so two users racing for the last unit cannot both succeed.

## How to run the app locally

### 1) Install dependencies

```bash
cd allo-inventory
npm install
```

### 2) Create environment variables

Copy `.env.example` to `.env.local` and fill it with real values.

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/dbname"
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
CRON_SECRET="your-random-secret-string"
```

Where each value comes from:

- `DATABASE_URL` and `DIRECT_URL`: Supabase, Neon, or another hosted PostgreSQL provider
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis console
- `CRON_SECRET`: any strong random secret you generate yourself

### 3) Generate Prisma client

```bash
npm run prisma:generate
```

### 4) Run database migrations

```bash
npm run prisma:migrate
```

If this is the first setup, Prisma will create the tables described in `prisma/schema.prisma`.

### 5) Seed demo data

```bash
npm run seed
```

This loads sample warehouses, products, and stock so the app has data immediately after startup.

### 6) Start the app

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Optional validation

```bash
npm run lint
npm run build
```

## How the expiry mechanism works in production

Expiry is handled by a Vercel Cron job.

- `vercel.json` schedules `GET /api/cron/cleanup` every 2 minutes.
- The cleanup endpoint finds reservations in `PENDING` state whose `expiresAt` is older than the current time.
- Each expired reservation is released inside a transaction.
- The associated stock row is updated so the reserved units become available again.

Why this approach:

- It is simple to deploy on Vercel.
- It keeps the expiration logic centralized in the backend.
- It avoids depending on a separate always-on worker process.

I kept the frontend countdown client-side only. The UI shows the reservation timer for the current user, while the server remains the source of truth for actual expiry.

## Data model

The main entities are:

- `Product`
- `Warehouse`
- `Stock`
- `Reservation`

The important relationships are:

- a product can exist in multiple warehouses
- each warehouse can hold stock for many products
- each reservation is tied to exactly one product and one warehouse

## Trade-offs and decisions

- I used PostgreSQL row locking instead of Redis distributed locks for reservation creation, because the stock row is the real source of truth.
- I kept the expiry process cron-driven instead of building a separate worker, because it fits Vercel much better.
- I kept the UI simple and predictable rather than adding WebSockets or SSE, because the assignment is mainly about correctness and clarity.
- I used Redis for idempotency support rather than for locking, so each concern stays separated.

## What I would do with more time

- Add full E2E coverage for the reservation flow
- Add a proper admin dashboard for inventory monitoring
- Add WebSocket or SSE updates for live stock changes
- Add rate limiting and stronger abuse protection on reservation endpoints
- Add better observability around expiry and reservation failures
- Add more structured concurrency tests against a real PostgreSQL instance

## Testing

The repository now includes Jest-based tests for the reservation logic.

```bash
npm test
```

The current suite validates that:

- reservations are created when stock is available
- over-reservation returns a conflict
- only one request can claim the last unit in the tested flow

## Project structure

- `src/app` contains the Next.js app and API routes
- `src/lib` contains Prisma, inventory, API, and idempotency helpers
- `src/schemas` contains Zod validation schemas
- `prisma` contains the database schema, migrations, and seed script
- `src/__tests__` contains the test coverage added for this assignment

## Submission note

The file `README (10).md` at the workspace root is the assignment brief. This `README.md` inside `allo-inventory` is the single polished submission document for the app itself.
