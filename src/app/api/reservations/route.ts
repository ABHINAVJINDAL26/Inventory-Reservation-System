import { NextRequest } from "next/server";
import { jsonResponse, runJson } from "@/lib/api";
import { createReservation } from "@/lib/inventory";
import { reserveRequestSchema } from "@/schemas/reservation";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(request: NextRequest) {
  const parsedBody = reserveRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return jsonResponse({
      status: 400,
      body: { error: "Invalid reservation payload.", code: "bad_request" },
    });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key");

  const execute = () =>
    runJson(async () => ({
      status: 201,
      body: await createReservation(parsedBody.data),
    }));

  const result = idempotencyKey ? await withIdempotency(idempotencyKey, execute) : await execute();

  return jsonResponse(result);
}
