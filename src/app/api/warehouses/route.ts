import { jsonResponse } from "@/lib/api";
import { getCatalogPayload } from "@/lib/inventory";

export async function GET() {
  const payload = await getCatalogPayload();

  return jsonResponse({ status: 200, body: payload.warehouses });
}
