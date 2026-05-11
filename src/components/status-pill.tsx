import type { ReservationStatus } from "@/types/inventory";

const statusClasses: Record<ReservationStatus, string> = {
  PENDING: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  CONFIRMED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  RELEASED: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

export function StatusPill({ status }: { status: ReservationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${statusClasses[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}
