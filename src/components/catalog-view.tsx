"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { CatalogPayload, ProductSummary } from "@/types/inventory";
import { formatPrice } from "@/lib/format";

function reserveDefaultProduct(product: ProductSummary) {
  const firstAvailable = product.stocks.find((stock) => stock.available > 0);
  return {
    warehouseId: firstAvailable?.warehouseId ?? product.stocks[0]?.warehouseId ?? "",
    quantity: 1,
  };
}

export function CatalogView({ products, warehouses }: CatalogPayload) {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasProducts = useMemo(() => products.length > 0, [products.length]);

  function openReservation(product: ProductSummary) {
    const defaults = reserveDefaultProduct(product);

    setSelectedProduct(product);
    setWarehouseId(defaults.warehouseId);
    setQuantity(defaults.quantity);
    setError(null);
  }

  async function submitReservation() {
    if (!selectedProduct || !warehouseId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          warehouseId,
          quantity,
        }),
      });

      const payload = (await response.json()) as { error?: string; id?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to create reservation.");
        return;
      }

      setSelectedProduct(null);
      router.push(`/reservation/${payload.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create reservation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <span className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
            Allo Inventory
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-50 md:text-6xl">
            Reserve stock without racing the payment window.
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            Products are held for 10 minutes at checkout. Stock stays accurate across warehouses,
            and confirmed orders permanently decrement inventory once payment clears.
          </p>
        </div>

        <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-200">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span>Products</span>
            <span className="font-semibold text-slate-50">{products.length}</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span>Warehouses</span>
            <span className="font-semibold text-slate-50">{warehouses.length}</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span>Hold window</span>
            <span className="font-semibold text-slate-50">10 minutes</span>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Catalog</h2>
            <p className="mt-1 text-sm text-slate-400">Pick a warehouse, reserve units, then confirm on the reservation page.</p>
          </div>
        </div>

        {!hasProducts ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 px-6 py-14 text-center text-slate-400">
            No products are seeded yet.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const allOutOfStock = product.stocks.every((stock) => stock.available === 0);

              return (
                <article key={product.id} className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
                  <div className="aspect-[16/10] bg-slate-900/60">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.name} width={1200} height={750} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">No image</div>
                    )}
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-50">{product.name}</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">SKU {product.sku}</p>
                      </div>
                      <div className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-sm font-semibold text-indigo-200">
                        {formatPrice(product.price)}
                      </div>
                    </div>

                    {product.description ? <p className="text-sm leading-6 text-slate-300">{product.description}</p> : null}

                    <div className="space-y-2">
                      {product.stocks.map((stock) => (
                        <div key={stock.warehouseId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm">
                          <div>
                            <p className="font-medium text-slate-100">{stock.warehouseName}</p>
                            <p className="text-xs text-slate-400">{stock.warehouseLocation}</p>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${stock.available > 0 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}>
                              {stock.available} available
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={allOutOfStock}
                      onClick={() => openReservation(product)}
                      className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                    >
                      {allOutOfStock ? "Out of stock" : "Reserve"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-slate-50">Reserve {selectedProduct.name}</h3>
                <p className="mt-1 text-sm text-slate-400">Choose a warehouse and hold the units for checkout.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-200">Warehouse</span>
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-50 outline-none ring-0 transition focus:border-indigo-400"
                >
                  {selectedProduct.stocks.map((stock) => (
                    <option key={stock.warehouseId} value={stock.warehouseId} disabled={stock.available === 0}>
                      {stock.warehouseName} - {stock.available} available
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-200">Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(selectedProduct.stocks.find((stock) => stock.warehouseId === warehouseId)?.available ?? 1, 1)}
                  value={quantity}
                  onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-50 outline-none ring-0 transition focus:border-indigo-400"
                />
              </label>

              {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

              <button
                type="button"
                onClick={() => void submitReservation()}
                disabled={isSubmitting || !warehouseId}
                className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isSubmitting ? "Reserving..." : "Confirm reservation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
