import { NextRequest } from "next/server";
import { jsonResponse, runJson } from "@/lib/api";
import { releaseReservation } from "@/lib/inventory";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await runJson(async () => ({
    status: 200,
    body: await releaseReservation(id),
  }));

  return jsonResponse(result);
}
