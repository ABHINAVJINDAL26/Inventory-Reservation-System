import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { conflict, gone, notFound } from "@/lib/errors";
import type { CatalogPayload, ProductSummary, ReservationSummary, StockSummary, WarehouseSummary } from "@/types/inventory";

const reservationWindowMinutes = 10;

type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

type WarehouseRow = {
  id: string;
  name: string;
  location: string;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: { toString(): string };
  sku: string;
  stocks: StockRow[];
};

type StockRow = {
  id: string;
  productId: string;
  warehouseId: string;
  totalUnits: number;
  reserved: number;
  warehouse: WarehouseRow;
};

type ReservationRow = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  releasedAt: Date | null;
  product: Pick<ProductRow, "id" | "name" | "sku" | "price">;
  warehouse: WarehouseRow;
};

type LockedStockRow = Pick<StockRow, "id" | "productId" | "warehouseId" | "totalUnits" | "reserved">;
type LockedReservationRow = Pick<
  ReservationRow,
  "id" | "productId" | "warehouseId" | "quantity" | "status" | "expiresAt" | "createdAt" | "updatedAt" | "confirmedAt" | "releasedAt"
>;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function availableUnits(totalUnits: number, reserved: number) {
  return Math.max(totalUnits - reserved, 0);
}

function mapWarehouse(warehouse: WarehouseRow): WarehouseSummary {
  return {
    id: warehouse.id,
    name: warehouse.name,
    location: warehouse.location,
  };
}

function mapStock(stock: StockRow): StockSummary {
  return {
    warehouseId: stock.warehouseId,
    warehouseName: stock.warehouse.name,
    warehouseLocation: stock.warehouse.location,
    totalUnits: stock.totalUnits,
    reserved: stock.reserved,
    available: availableUnits(stock.totalUnits, stock.reserved),
  };
}

function mapProduct(product: ProductRow): ProductSummary {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price.toString(),
    sku: product.sku,
    stocks: product.stocks
      .map((stock) => mapStock(stock))
      .sort((left, right) => left.warehouseName.localeCompare(right.warehouseName)),
  };
}

function mapReservation(reservation: ReservationRow): ReservationSummary {
  const productPrice = reservation.product?.price ? (typeof reservation.product.price === 'object' && typeof (reservation.product.price as any).toString === 'function' ? (reservation.product.price as any).toString() : String(reservation.product.price)) : '0';

  return {
    id: reservation.id,
    productId: reservation.productId,
    productName: reservation.product?.name ?? null,
    productSku: reservation.product?.sku ?? null,
    productPrice,
    warehouseId: reservation.warehouseId,
    warehouseName: reservation.warehouse.name,
    warehouseLocation: reservation.warehouse.location,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: iso(reservation.expiresAt) ?? new Date().toISOString(),
    createdAt: iso(reservation.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(reservation.updatedAt) ?? new Date().toISOString(),
    confirmedAt: iso(reservation.confirmedAt),
    releasedAt: iso(reservation.releasedAt),
  };
}

async function releaseReservationRow(tx: Prisma.TransactionClient, reservationRow: LockedReservationRow) {
  await tx.stock.update({
    where: {
      productId_warehouseId: {
        productId: reservationRow.productId,
        warehouseId: reservationRow.warehouseId,
      },
    },
    data: {
      reserved: { decrement: reservationRow.quantity },
    },
  });

  return tx.reservation.update({
    where: { id: reservationRow.id },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
    },
    include: {
      product: true,
      warehouse: true,
    },
  });
}

export async function getCatalogPayload(): Promise<CatalogPayload> {
  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        stocks: {
          include: { warehouse: true },
        },
      },
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    products: products.map(mapProduct),
    warehouses: warehouses.map(mapWarehouse),
  };
}

export async function getReservationById(id: string): Promise<ReservationSummary | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: true,
      warehouse: true,
    },
  });

  return reservation ? mapReservation(reservation) : null;
}

export async function createReservation(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
}): Promise<ReservationSummary> {
  const reservation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Raise per-transaction statement timeout to avoid short interactive timeouts
    await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 20000');
    const lockedStocks = (await tx.$queryRawUnsafe(
      'SELECT "id", "productId", "warehouseId", "totalUnits", "reserved" FROM "Stock" WHERE "productId" = $1 AND "warehouseId" = $2 FOR UPDATE',
      input.productId,
      input.warehouseId,
    )) as LockedStockRow[];

    const lockedStock = lockedStocks[0];

    if (!lockedStock) {
      throw notFound("Stock record not found for the selected product and warehouse.");
    }

    if (availableUnits(lockedStock.totalUnits, lockedStock.reserved) < input.quantity) {
      throw conflict("Not enough stock available for the requested reservation.");
    }

    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      data: {
        reserved: { increment: input.quantity },
      },
    });

    return tx.reservation.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        status: "PENDING",
        expiresAt: new Date(Date.now() + reservationWindowMinutes * 60 * 1000),
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  });

  return mapReservation(reservation);
}

export async function confirmReservation(id: string): Promise<ReservationSummary> {
  const reservation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Increase timeout in case of transient DB latency
    await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 20000');
    const rows = (await tx.$queryRawUnsafe(
      'SELECT "id", "productId", "warehouseId", "quantity", "status", "expiresAt", "createdAt", "updatedAt", "confirmedAt", "releasedAt" FROM "Reservation" WHERE "id" = $1 FOR UPDATE',
      id,
    )) as LockedReservationRow[];

    const lockedReservation = rows[0];

    if (!lockedReservation) {
      throw notFound("Reservation not found.");
    }

    if (lockedReservation.status === "CONFIRMED") {
      throw conflict("Reservation has already been confirmed.");
    }

    if (lockedReservation.status === "RELEASED") {
      throw conflict("Reservation has already been released.");
    }

    if (lockedReservation.expiresAt <= new Date()) {
      await releaseReservationRow(tx, lockedReservation);
      throw gone("Reservation has expired.");
    }

    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: lockedReservation.productId,
          warehouseId: lockedReservation.warehouseId,
        },
      },
      data: {
        reserved: { decrement: lockedReservation.quantity },
        totalUnits: { decrement: lockedReservation.quantity },
      },
    });

    return tx.reservation.update({
      where: { id: lockedReservation.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  });

  return mapReservation(reservation);
}

export async function releaseReservation(id: string): Promise<ReservationSummary> {
  const reservation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Increase timeout for confirmation operations
    await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 20000');
    const rows = (await tx.$queryRawUnsafe(
      'SELECT "id", "productId", "warehouseId", "quantity", "status", "expiresAt", "createdAt", "updatedAt", "confirmedAt", "releasedAt" FROM "Reservation" WHERE "id" = $1 FOR UPDATE',
      id,
    )) as LockedReservationRow[];

    const lockedReservation = rows[0];

    if (!lockedReservation) {
      throw notFound("Reservation not found.");
    }

    if (lockedReservation.status === "CONFIRMED") {
      throw conflict("Reservation has already been confirmed.");
    }

    if (lockedReservation.status === "RELEASED") {
      throw conflict("Reservation has already been released.");
    }

    const releasedReservation = await releaseReservationRow(tx, lockedReservation);
    return releasedReservation;
  });

  return mapReservation(reservation);
}

export async function cleanupExpiredReservations() {
  const now = new Date();

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Increase timeout for cleanup operations
    await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 20000');
    const expiredReservations = (await tx.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
      select: {
        id: true,
        productId: true,
        warehouseId: true,
        quantity: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        confirmedAt: true,
        releasedAt: true,
      },
    })) as LockedReservationRow[];

    for (const reservationRow of expiredReservations) {
      await releaseReservationRow(tx, reservationRow);
    }

    return expiredReservations.length;
  });
}
