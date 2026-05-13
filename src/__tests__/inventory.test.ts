/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
import { createReservation, confirmReservation, releaseReservation } from '@/lib/inventory';

// Mock prisma with an in-memory store and serialized transactions to emulate SELECT FOR UPDATE
jest.mock('@/lib/prisma', () => {
  type StockRow = { id: string; productId: string; warehouseId: string; totalUnits: number; reserved: number };
  type ReservationRow = any;

  const initialStocks: Record<string, StockRow> = {
    'prod-1|wh-1': { id: 's1', productId: 'prod-1', warehouseId: 'wh-1', totalUnits: 5, reserved: 0 },
  };

  let stocks: Record<string, StockRow> = {};
  const reservations: Record<string, ReservationRow> = {};
  let reservationCounter = 1;

  function resetState() {
    stocks = JSON.parse(JSON.stringify(initialStocks));
    for (const k of Object.keys(reservations)) delete reservations[k];
    reservationCounter = 1;
  }

  function getStockSnapshot() {
    return JSON.parse(JSON.stringify(stocks));
  }

  function getReservationSnapshot(id: string) {
    const reservation = reservations[id];
    return reservation ? JSON.parse(JSON.stringify(reservation)) : null;
  }

  function setReservationExpiresAt(id: string, expiresAt: Date) {
    if (reservations[id]) {
      reservations[id].expiresAt = expiresAt;
    }
  }

  resetState();

  // Simple queue to serialize transactions (mimic FOR UPDATE locking)
  const txQueue: (() => Promise<any>)[] = [];
  let running = false;

  async function runQueue() {
    if (running) return;
    running = true;
    while (txQueue.length) {
      const fn = txQueue.shift()!;
      try {
        await fn();
      } catch (e) {
        // swallow in queue processing
      }
    }
    running = false;
  }

  const mockPrisma: any = {
    $transaction: (cb: any) => {
      return new Promise((resolve, reject) => {
        txQueue.push(async () => {
          // create a tx object exposing needed methods
          const tx = {
            $executeRawUnsafe: async (_: string) => undefined,
            $queryRawUnsafe: async (sql: string, ...params: any[]) => {
              // detect whether querying Stock or Reservation by presence of $1
              if (sql.includes('FROM "Stock"')) {
                const productId = params[0];
                const warehouseId = params[1];
                const key = `${productId}|${warehouseId}`;
                const s = stocks[key];
                return s ? [{ id: s.id, productId: s.productId, warehouseId: s.warehouseId, totalUnits: s.totalUnits, reserved: s.reserved }] : [];
              }

              if (sql.includes('FROM "Reservation"')) {
                const id = params[0];
                const r = reservations[id];
                return r ? [{ ...r }] : [];
              }

              return [];
            },
            stock: {
              update: async ({ where, data }: any) => {
                const key = `${where.productId_warehouseId.productId}|${where.productId_warehouseId.warehouseId}`;
                const s = stocks[key];
                if (!s) throw new Error('Stock not found');
                if (data.reserved?.increment) s.reserved += data.reserved.increment;
                if (data.reserved?.decrement) s.reserved -= data.reserved.decrement;
                if (data.totalUnits?.decrement) s.totalUnits -= data.totalUnits.decrement;
                return s;
              },
            },
            reservation: {
              create: async ({ data, include }: any) => {
                const id = `res-${reservationCounter++}`;
                const row = {
                  id,
                  productId: data.productId,
                  warehouseId: data.warehouseId,
                  quantity: data.quantity,
                  status: data.status,
                  expiresAt: data.expiresAt,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  confirmedAt: null,
                  releasedAt: null,
                  product: { id: data.productId, name: 'Test Product', sku: 'TP-1' },
                  warehouse: { id: data.warehouseId, name: 'WH', location: 'LOC' },
                };
                reservations[id] = row;
                return row;
              },
              findMany: async ({ where }: any) => {
                const now = new Date();
                return Object.values(reservations).filter((r: any) => r.status === where.status && r.expiresAt < where.expiresAt.lt);
              },
              findUnique: async ({ where }: any) => {
                return reservations[where.id] ?? null;
              },
              update: async ({ where, data }: any) => {
                const r = reservations[where.id];
                if (!r) throw new Error('Reservation not found');
                Object.assign(r, data);
                r.updatedAt = new Date();
                return r;
              },
            },
          };

          try {
            const result = await cb(tx);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });

        // kick the queue
        runQueue();
      });
    },
  };

  mockPrisma.__reset = resetState;
  mockPrisma.__getStockSnapshot = getStockSnapshot;
  mockPrisma.__getReservationSnapshot = getReservationSnapshot;
  mockPrisma.__setReservationExpiresAt = setReservationExpiresAt;

  return { prisma: mockPrisma };
});

describe('inventory.createReservation', () => {
  beforeEach(() => {
    const { prisma } = require('@/lib/prisma');
    if (prisma.__reset) prisma.__reset();
  });

  test('creates reservation when stock available', async () => {
    const res = await createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 2 });
    expect(res).toHaveProperty('id');
    expect(res.quantity).toBe(2);
  });

  test('returns conflict when insufficient stock', async () => {
    // reserve all available units (5) then attempt one more
    await createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 5 });
    await expect(createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 1 })).rejects.toMatchObject({ status: 409 });
  });

  test('concurrent reservations allow only one for last unit', async () => {
    // Make deterministic: set stock to 1 and call sequentially
    const { prisma } = require('@/lib/prisma');
    // reduce totalUnits to 1
    await prisma.$transaction(async (tx: any) => {
      await tx.stock.update({ where: { productId_warehouseId: { productId: 'prod-1', warehouseId: 'wh-1' } }, data: { totalUnits: { decrement: 4 } } });
    });

    // First reservation should succeed
    const r1 = await createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 1 });
    expect(r1).toHaveProperty('id');

    // Second reservation should fail with conflict
    await expect(createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 1 })).rejects.toMatchObject({ status: 409 });
  });

  test('confirms an active reservation and consumes reserved stock', async () => {
    const reservation = await createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 2 });
    const confirmed = await confirmReservation(reservation.id);

    expect(confirmed.status).toBe('CONFIRMED');

    const { prisma } = require('@/lib/prisma');
    const stock = prisma.__getStockSnapshot()['prod-1|wh-1'];
    expect(stock.reserved).toBe(0);
    expect(stock.totalUnits).toBe(3);
  });

  test('releases a pending reservation and restores reserved stock', async () => {
    const reservation = await createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 2 });
    const released = await releaseReservation(reservation.id);

    expect(released.status).toBe('RELEASED');

    const { prisma } = require('@/lib/prisma');
    const stock = prisma.__getStockSnapshot()['prod-1|wh-1'];
    expect(stock.reserved).toBe(0);
    expect(stock.totalUnits).toBe(5);
  });

  test('cleanup releases expired reservations and returns count', async () => {
    const { cleanupExpiredReservations } = require('@/lib/inventory');
    const reservation = await createReservation({ productId: 'prod-1', warehouseId: 'wh-1', quantity: 1 });

    const { prisma } = require('@/lib/prisma');
    prisma.__setReservationExpiresAt(reservation.id, new Date(Date.now() - 60_000));

    const cleaned = await cleanupExpiredReservations();
    expect(cleaned).toBe(1);

    const reservationSnapshot = prisma.__getReservationSnapshot(reservation.id);
    expect(reservationSnapshot.status).toBe('RELEASED');

    const stock = prisma.__getStockSnapshot()['prod-1|wh-1'];
    expect(stock.reserved).toBe(0);
    expect(stock.totalUnits).toBe(5);
  });
});
