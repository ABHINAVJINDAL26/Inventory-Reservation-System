import { NextRequest } from "next/server";
import { jsonResponse, runJson } from "@/lib/api";
import { cleanupExpiredReservations } from "@/lib/inventory";

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");
  const providedSecret = authorization?.replace(/^Bearer\s+/i, "") ?? querySecret;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return jsonResponse({
      status: 401,
      body: { error: "Unauthorized.", code: "unauthorized" },
    });
  }

  const result = await runJson(async () => ({
    status: 200,
    body: { released: await cleanupExpiredReservations() },
  }));

  return jsonResponse(result);
}
