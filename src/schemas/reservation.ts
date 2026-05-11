import { z } from "zod";

export const reserveRequestSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export type ReserveRequest = z.infer<typeof reserveRequestSchema>;
