import { NextRequest } from "next/server";
import { jsonResponse, runJson } from "@/lib/api";
import { confirmReservation } from "@/lib/inventory";
import { withIdempotency } from "@/lib/idempotency";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const idempotencyKey = request.headers.get("Idempotency-Key");

  const execute = () =>
    runJson(async () => ({
      status: 200,
      body: await confirmReservation(id),
    }));

  const result = idempotencyKey ? await withIdempotency(idempotencyKey, execute) : await execute();

  return jsonResponse(result);
}
