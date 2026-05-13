"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReservationSummary } from "@/types/inventory";
import { formatDateTime, formatPrice } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";

function secondsUntil(targetIso: string) {
  const milliseconds = new Date(targetIso).getTime() - Date.now();
  return Math.max(Math.ceil(milliseconds / 1000), 0);
}

function clockLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ReservationView({ initialReservation }: { initialReservation: ReservationSummary }) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(initialReservation.expiresAt));
  const [message, setMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"confirm" | "release" | null>(null);

  useEffect(() => {
    if (reservation.status !== "PENDING") {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds(secondsUntil(reservation.expiresAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [reservation.expiresAt, reservation.status]);

  async function runAction(path: string, label: "confirm" | "release") {
    setLoadingAction(label);
    setMessage(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(label === "confirm" ? { "Idempotency-Key": crypto.randomUUID() } : {}),
          ...(label === "release" ? { "Idempotency-Key": crypto.randomUUID() } : {}),
        },
      });

      const payload = (await response.json()) as Partial<ReservationSummary> & { error?: string };

      if (!response.ok) {
        let errorMessage = payload.error ?? "Unable to update reservation.";
        
        if (response.status === 410) {
          errorMessage = "Reservation expired. Please start a new reservation.";
        } else if (response.status === 409) {
          errorMessage = label === "confirm"
            ? "Reservation already confirmed or released. Cannot confirm again."
            : "Reservation already released. Cannot release again.";
        } else if (response.status === 404) {
          errorMessage = "Reservation not found.";
        } else if (response.status === 400) {
          errorMessage = payload.error ?? "Invalid request. Please check your input.";
        }
        
        setMessage(errorMessage);
        return;
      }

      if (payload.status) {
        setReservation((current) => ({
          ...current,
          status: payload.status ?? current.status,
          confirmedAt: payload.confirmedAt ?? current.confirmedAt,
          releasedAt: payload.releasedAt ?? current.releasedAt,
          updatedAt: payload.updatedAt ?? current.updatedAt,
        }));
      }

      if (label === "release") {
        setMessage("Reservation released. Redirecting home...");
        window.setTimeout(() => {
          router.push("/");
        }, 2000);
      }

      if (label === "confirm") {
        setMessage("Reservation confirmed. Inventory has been decremented.");
      }
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Unable to update reservation.");
    } finally {
      setLoadingAction(null);
    }
  }

  const isPending = reservation.status === "PENDING";
  const timerTone = remainingSeconds <= 60 ? "text-rose-300" : remainingSeconds <= 180 ? "text-amber-300" : "text-slate-50";
  const expiryMessage = isPending && remainingSeconds === 0 ? "Reservation expired. The stock has been released." : null;

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-xl sm:rounded-2xl md:rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 md:p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <span className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200">
              Reservation
            </span>
            <h1 className="mt-4 text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight text-slate-50 break-words">{reservation.productName}</h1>
            <p className="mt-3 max-w-xl text-xs sm:text-sm leading-6 sm:leading-7 text-slate-300">
              {reservation.quantity} unit{reservation.quantity > 1 ? "s" : ""} reserved from {reservation.warehouseName}, {reservation.warehouseLocation}.
            </p>
          </div>
          <div className="flex-shrink-0">
            <StatusPill status={reservation.status} />
          </div>
        </div>

        <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
          <div className="rounded-lg sm:rounded-3xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">SKU</p>
            <p className="mt-2 font-medium text-slate-100 text-sm sm:text-base">{reservation.productSku}</p>
          </div>
          <div className="rounded-lg sm:rounded-3xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Expires at</p>
            <p className="mt-2 font-medium text-slate-100 text-sm sm:text-base">{formatDateTime(reservation.expiresAt)}</p>
          </div>
          <div className="rounded-lg sm:rounded-3xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Created</p>
            <p className="mt-2 font-medium text-slate-100 text-sm sm:text-base">{formatDateTime(reservation.createdAt)}</p>
          </div>
          <div className="rounded-lg sm:rounded-3xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Value</p>
            <p className="mt-2 font-medium text-slate-100 text-sm sm:text-base">{formatPrice("2999")}</p>
          </div>
        </div>

        <div className="mt-8 rounded-lg sm:rounded-2xl md:rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Countdown</p>
          <div className={`mt-2 font-mono text-4xl sm:text-5xl font-semibold tracking-tight ${timerTone} ${remainingSeconds <= 60 && isPending ? "animate-pulse" : ""}`}>
            {isPending ? clockLabel(remainingSeconds) : reservation.status === "CONFIRMED" ? "00:00" : "--:--"}
          </div>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            {isPending ? "Hold the line until checkout completes." : "The reservation is no longer pending."}
          </p>
        </div>

        {message || expiryMessage ? (
          <div className="mt-6 rounded-lg sm:rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-200">
            {message ?? expiryMessage}
          </div>
        ) : null}
      </section>

      <aside className="space-y-4 rounded-xl sm:rounded-2xl md:rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 md:p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-50">Actions</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">Confirm after payment succeeds or release the hold early if the checkout is cancelled.</p>
        </div>

        <button
          type="button"
          disabled={!isPending || loadingAction !== null || remainingSeconds === 0}
          onClick={() => void runAction(`/api/reservations/${reservation.id}/confirm`, "confirm")}
          className="w-full rounded-lg sm:rounded-2xl bg-emerald-500 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 min-h-10"
        >
          {loadingAction === "confirm" ? "Confirming..." : "Confirm purchase"}
        </button>

        <button
          type="button"
          disabled={!isPending || loadingAction !== null}
          onClick={() => void runAction(`/api/reservations/${reservation.id}/release`, "release")}
          className="w-full rounded-lg sm:rounded-2xl border border-white/10 bg-white/5 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:bg-slate-800 min-h-10"
        >
          {loadingAction === "release" ? "Releasing..." : "Cancel reservation"}
        </button>

        <div className="rounded-lg sm:rounded-2xl md:rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-4 sm:p-5 text-xs sm:text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Reservation status</p>
          <div className="mt-3">
            <StatusPill status={reservation.status} />
          </div>
          <p className="mt-4 leading-6 text-xs sm:text-sm">
            {reservation.status === "CONFIRMED"
              ? "The hold has been converted into a finalized sale."
              : reservation.status === "RELEASED"
                ? "The stock is back in circulation and available to other shoppers."
                : "The hold is live and waiting on payment confirmation."}
          </p>
        </div>
      </aside>
    </div>
  );
}
