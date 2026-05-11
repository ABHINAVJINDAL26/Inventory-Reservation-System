export type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

export type WarehouseSummary = {
  id: string;
  name: string;
  location: string;
};

export type StockSummary = {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reserved: number;
  available: number;
};

export type ProductSummary = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  sku: string;
  stocks: StockSummary[];
};

export type ReservationSummary = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
};

export type CatalogPayload = {
  products: ProductSummary[];
  warehouses: WarehouseSummary[];
};
