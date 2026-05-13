import { notFound } from "next/navigation";
import { ReservationView } from "@/components/reservation-view";
import { getReservationById } from "@/lib/inventory";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ReservationPage({ params }: Params) {
  const { id } = await params;
  const reservation = await getReservationById(id);

  if (!reservation) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 items-start px-3 py-6 sm:px-4 md:px-8 lg:py-10">
      <ReservationView initialReservation={reservation} />
    </main>
  );
}
