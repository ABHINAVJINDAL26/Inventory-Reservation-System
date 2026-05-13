import { NextRequest } from "next/server";
import { jsonResponse, runJson } from "@/lib/api";
import { releaseReservation } from "@/lib/inventory";
import { withIdempotency } from "@/lib/idempotency";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const idempotencyKey = request.headers.get("Idempotency-Key");

  const executeRelease = async () => ({
    status: 200,
    body: await releaseReservation(id),
  });

  const result = await runJson(async () => {
    if (idempotencyKey) {
      return await withIdempotency(idempotencyKey, executeRelease);
    }
    return await executeRelease();
  });

  return jsonResponse(result);
}
