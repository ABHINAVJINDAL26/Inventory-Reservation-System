# Allo Inventory Reservation System

Inventory reservation app for a multi-warehouse checkout flow.

Live demo: https://inventory-reservation-system-slk4.vercel.app/

## Overview

This project handles stock reservations while a customer is checking out. The flow is simple: create a temporary hold, confirm it after payment succeeds, and release it if payment fails or the hold expires.

The main goal is to avoid overselling when multiple users are checking out at the same time and to keep stock availability accurate across warehouses.

## What the app does

1. A customer opens the catalog and picks a product.
2. The app creates a short-lived reservation for the requested quantity.
3. If payment succeeds, the reservation is confirmed and stock is decremented.
4. If payment fails, the user cancels, or the timer expires, the reservation is released back to available stock.

## Features

- Catalog view with stock by warehouse
- Reservation flow with a 10-minute hold window
- Reservation detail page with confirm and release actions
- Automatic cleanup for expired reservations
- Idempotent reservation requests
- Seeded demo data for testing right away
- Live countdown on the reservation page
- Responsive UI for mobile, tablet, and desktop

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- Upstash Redis
- Zod
- Tailwind CSS
- Jest

## Key Design Rules

- Available stock is derived, not stored separately.

```text
availableUnits = totalUnits - reserved
```

- Reservation creation uses database row locking so two users cannot claim the same last unit.
- Redis is used for idempotency, not for stock locking.
- Expired reservations are cleaned up by a cron endpoint.

## Data Model

Main entities:

- `Product`
- `Warehouse`
- `Stock`
- `Reservation`
- `IdempotencyKey`

Relationship summary:

- One product can exist in multiple warehouses.
- One warehouse can hold stock for many products.
- Each reservation belongs to one product and one warehouse.
- Each stock row is unique for a product and warehouse pair.

## API Routes

- `GET /api/products`
- `GET /api/warehouses`
- `POST /api/reservations`
- `GET /api/reservations/:id`
- `POST /api/reservations/:id/confirm`
- `POST /api/reservations/:id/release`
- `GET /api/cron/cleanup`

## API Behavior

`GET /api/products`

- Returns products with stock broken down by warehouse.
- Each stock entry includes total, reserved, and available quantity.

`GET /api/warehouses`

- Returns the list of warehouses.

`POST /api/reservations`

- Creates a temporary hold.
- Requires `productId`, `warehouseId`, and `quantity`.
- Returns `409 Conflict` when not enough stock is available.
- Returns `400 Bad Request` for invalid payloads.

`POST /api/reservations/:id/confirm`

- Confirms a reservation after payment succeeds.
- Returns `410 Gone` if the reservation already expired.
- Returns `409 Conflict` if it is already confirmed or released.

`POST /api/reservations/:id/release`

- Releases the hold when the user cancels or payment fails.

`GET /api/cron/cleanup`

- Releases expired `PENDING` reservations and updates stock.

## Concurrency and Expiry

The reservation write path uses a transaction with row locking (`SELECT FOR UPDATE`) so stock cannot be double-booked. This is the safest part of the system and the main reason the app stays correct under concurrent checkout traffic.

Expiry is handled by a scheduled cleanup job. On Vercel Hobby, the project uses a daily Vercel cron schedule, and a GitHub Actions workflow is included for more frequent cleanup scheduling.

## Frontend Pages

`/`

- Product catalog
- Stock display by warehouse
- Reserve modal with warehouse and quantity selection

`/reservation/:id`

- Reservation details
- Countdown timer
- Confirm and release actions
- Status badge for `PENDING`, `CONFIRMED`, and `RELEASED`

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

## Seed Data

The seed script creates demo warehouses, products, and stock so the app works immediately after setup.

Seeded warehouses:

- Mumbai Hub
- Delhi Hub
- Bengaluru Hub

Seeded products:

- Wireless Headphones
- Mechanical Keyboard
- USB-C Hub
- Webcam HD
- Laptop Stand

## Deployment

The app is deployed on Vercel.

Production URL:

- https://inventory-reservation-system-slk4.vercel.app/

Required environment variables in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`

The repo also includes a GitHub Actions workflow for cleanup scheduling on Hobby plans.

## Testing

The repository includes Jest coverage for the reservation logic.

```bash
npm test
```

The test coverage checks:

- reservations are created when stock is available
- stock conflicts return the expected error
- confirm, release, and cleanup flows behave correctly

## Project Structure

- `src/app` - routes, pages, and API handlers
- `src/components` - reusable UI components
- `src/lib` - inventory logic, API helpers, formatting, Prisma client
- `src/schemas` - request validation schemas
- `prisma` - schema, migrations, and seed script
- `src/__tests__` - reservation lifecycle tests

## Notes

- `.env`, `.env.local`, `node_modules`, and `.next` are ignored and not part of the repository.
- The repo is kept lean and readable, with the main logic in the API and inventory layer.
- For faster cleanup runs on Vercel, use GitHub Actions or move to a plan with more cron support.
