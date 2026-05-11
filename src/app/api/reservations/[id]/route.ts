import { jsonResponse } from "@/lib/api";
import { getReservationById } from "@/lib/inventory";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const reservation = await getReservationById(id);

  if (!reservation) {
    return jsonResponse({
      status: 404,
      body: { error: "Reservation not found.", code: "not_found" },
    });
  }

  return jsonResponse({ status: 200, body: reservation });
}
