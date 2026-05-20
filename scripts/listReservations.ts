import 'dotenv/config';
import { prisma } from '@/lib/prisma';

(async () => {
  try {
    const productId = 'cmp4f792y00033wesmv7c0jr4';
    const warehouseId = 'cmp4f784p00003wes59hh6syd';

    const res = await prisma.reservation.findMany({
      where: { productId, warehouseId },
      orderBy: { createdAt: 'asc' },
      include: { product: true, warehouse: true },
    });

    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
