import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.stock.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const warehouses = await prisma.warehouse.createManyAndReturn({
    data: [
      { name: "Mumbai Hub", location: "Mumbai, MH" },
      { name: "Delhi Hub", location: "Delhi, DL" },
      { name: "Bengaluru Hub", location: "Bengaluru, KA" },
    ],
  });

  const products = await prisma.product.createManyAndReturn({
    data: [
      {
        name: "Wireless Headphones",
        description: "Noise-isolating headphones with 30-hour battery life.",
        imageUrl: "https://images.unsplash.com/photo-1518441902117-f0a01d8d7f0f?auto=format&fit=crop&w=1200&q=80",
        price: 2999,
        sku: "WH-001",
      },
      {
        name: "Mechanical Keyboard",
        description: "Hot-swappable keyboard with tactile switches.",
        imageUrl: "https://images.unsplash.com/photo-1541140532154-b024d705b90a?auto=format&fit=crop&w=1200&q=80",
        price: 4499,
        sku: "MK-002",
      },
      {
        name: "USB-C Hub",
        description: "Compact 7-in-1 hub for creators and travelers.",
        imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=1200&q=80",
        price: 1299,
        sku: "UC-003",
      },
      {
        name: "Webcam HD",
        description: "1080p webcam with low-light correction.",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80",
        price: 3799,
        sku: "WC-004",
      },
      {
        name: "Laptop Stand",
        description: "Aluminium stand with ergonomic height adjustment.",
        imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
        price: 899,
        sku: "LS-005",
      },
    ],
  });

  const stockMatrix = [
    [18, 9, 24],
    [14, 8, 20],
    [32, 12, 16],
    [11, 7, 13],
    [28, 15, 19],
  ];

  for (const [productIndex, product] of products.entries()) {
    for (const [warehouseIndex, warehouse] of warehouses.entries()) {
      await prisma.stock.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          totalUnits: stockMatrix[productIndex][warehouseIndex],
          reserved: 0,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
