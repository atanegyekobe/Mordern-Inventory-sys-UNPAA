"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";
import type { InventoryLot, InventoryMovement } from "@/lib/types";

type LedgerResponse = {
  movements: InventoryMovement[];
};

type LotResponse = {
  lots: InventoryLot[];
};

type LedgerView = "movements" | "lots";

const movementTypeTone: Record<InventoryMovement["movementType"], string> = {
  IN: "border-emerald-200 bg-emerald-50 text-emerald-800",
  OUT: "border-red-200 bg-red-50 text-red-800",
  ADJUSTMENT: "border-amber-200 bg-amber-50 text-amber-800",
};

const formatSignedQty = (value: number) => {
  if (value > 0) return `+${value}`;
  return String(value);
};

export default function StockLedgerPage() {
  const [view, setView] = useState<LedgerView>("movements");
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<"" | InventoryMovement["movementType"]>("");
  const [lotStatus, setLotStatus] = useState<"" | InventoryLot["status"]>("");
  const [productQuery, setProductQuery] = useState("");

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError(null);

      const movementQuery = new URLSearchParams({
        limit: "120",
      });

      if (movementType) {
        movementQuery.set("movementType", movementType);
      }

      const lotQuery = new URLSearchParams({
        limit: "160",
      });

      if (lotStatus) {
        lotQuery.set("status", lotStatus);
      }

      const [movementsResponse, lotsResponse] = await Promise.all([
        api.get<LedgerResponse>(`/admin/stock-movements?${movementQuery.toString()}`),
        api.get<LotResponse>(`/admin/stock-lots?${lotQuery.toString()}`),
      ]);

      setMovements(movementsResponse.data.movements ?? []);
      setLots(lotsResponse.data.lots ?? []);
    } catch {
      setError("Failed to load stock ledger records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementType, lotStatus]);

  const filteredMovements = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return movements;

    return movements.filter((movement) => {
      const haystack = `${movement.product?.name || ""} ${movement.product?.sku || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [movements, productQuery]);

  const filteredLots = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return lots;

    return lots.filter((lot) => {
      const haystack = `${lot.product?.name || ""} ${lot.product?.sku || ""} ${lot.lotCode}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [lots, productQuery]);

  const lotSummary = useMemo(() => {
    let totalInitial = 0;
    let totalRemaining = 0;
    let openLots = 0;

    for (const lot of filteredLots) {
      totalInitial += Number(lot.initialQty || 0);
      totalRemaining += Number(lot.remainingQty || 0);
      if (lot.status === "open") {
        openLots += 1;
      }
    }

    return {
      totalInitial,
      totalRemaining,
      consumed: totalInitial - totalRemaining,
      openLots,
    };
  }, [filteredLots]);

  return (
    <AdminShell title="Stock Ledger">
      <div className="space-y-5">
        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("movements")}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.11em] transition ${
                view === "movements"
                  ? "border-black bg-black text-white"
                  : "border-black/20 bg-white text-black/75 hover:border-black/40"
              }`}
            >
              Movement Timeline
            </button>
            <button
              type="button"
              onClick={() => setView("lots")}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.11em] transition ${
                view === "lots"
                  ? "border-black bg-black text-white"
                  : "border-black/20 bg-white text-black/75 hover:border-black/40"
              }`}
            >
              FIFO Lots
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                Movement Type
              </label>
              <select
                value={movementType}
                onChange={(event) =>
                  setMovementType(event.target.value as "" | InventoryMovement["movementType"])
                }
                className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                Lot Status
              </label>
              <select
                value={lotStatus}
                onChange={(event) => setLotStatus(event.target.value as "" | InventoryLot["status"])}
                className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="consumed">Consumed</option>
                <option value="void">Void</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                Product Search
              </label>
              <input
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="Name or SKU"
                className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={fetchLedger}
                className="w-full rounded-xl border border-black bg-black px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
              >
                Refresh Ledger
              </button>
            </div>
          </div>
        </section>

        {view === "lots" ? (
          <section className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-black/10 bg-black/2 p-3">
                <p className="text-xs uppercase tracking-[0.11em] text-black/55">Open Lots</p>
                <p className="mt-1 text-xl font-semibold text-black">{lotSummary.openLots}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-black/2 p-3">
                <p className="text-xs uppercase tracking-[0.11em] text-black/55">Initial Units</p>
                <p className="mt-1 text-xl font-semibold text-black tabular-nums">{lotSummary.totalInitial}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-black/2 p-3">
                <p className="text-xs uppercase tracking-[0.11em] text-black/55">Consumed Units</p>
                <p className="mt-1 text-xl font-semibold text-black tabular-nums">{lotSummary.consumed}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-black/2 p-3">
                <p className="text-xs uppercase tracking-[0.11em] text-black/55">Remaining Units</p>
                <p className="mt-1 text-xl font-semibold text-black tabular-nums">{lotSummary.totalRemaining}</p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-black/70">Loading FIFO lots...</p>
            ) : error ? (
              <p className="text-sm text-red-700">{error}</p>
            ) : filteredLots.length === 0 ? (
              <p className="text-sm text-black/70">No lot entries found for the current filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.11em] text-black/55">
                      <th className="border-b border-black/10 px-3 py-2 font-semibold">Received</th>
                      <th className="border-b border-black/10 px-3 py-2 font-semibold">Product</th>
                      <th className="border-b border-black/10 px-3 py-2 font-semibold">Lot</th>
                      <th className="border-b border-black/10 px-3 py-2 font-semibold">Source</th>
                      <th className="border-b border-black/10 px-3 py-2 font-semibold text-right">Initial</th>
                      <th className="border-b border-black/10 px-3 py-2 font-semibold text-right">Remaining</th>
                      <th className="border-b border-black/10 px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLots.map((lot) => (
                      <tr key={lot.id} className="odd:bg-black/2">
                        <td className="px-3 py-2 text-xs text-black/70">
                          {new Date(lot.receivedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-black">{lot.product?.name || "Unknown Product"}</p>
                          <p className="text-xs text-black/55">SKU: {lot.product?.sku || "-"}</p>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-black">{lot.lotCode}</td>
                        <td className="px-3 py-2 text-xs text-black/75">
                          <p>{lot.sourceType}</p>
                          {lot.note ? <p className="text-black/55">{lot.note}</p> : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-black">{lot.initialQty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-black">{lot.remainingQty}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              lot.status === "open"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : lot.status === "consumed"
                                ? "border-black/15 bg-black/5 text-black/75"
                                : "border-red-200 bg-red-50 text-red-700"
                            }`}
                          >
                            {lot.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-black/10 bg-white p-4">
          {loading ? (
            <p className="text-sm text-black/70">Loading stock movements...</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : filteredMovements.length === 0 ? (
            <p className="text-sm text-black/70">No movement entries found for the current filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.11em] text-black/55">
                    <th className="border-b border-black/10 px-3 py-2 font-semibold">When</th>
                    <th className="border-b border-black/10 px-3 py-2 font-semibold">Product</th>
                    <th className="border-b border-black/10 px-3 py-2 font-semibold">Type</th>
                    <th className="border-b border-black/10 px-3 py-2 font-semibold text-right">Change</th>
                    <th className="border-b border-black/10 px-3 py-2 font-semibold text-right">After</th>
                    <th className="border-b border-black/10 px-3 py-2 font-semibold">Reason</th>
                    <th className="border-b border-black/10 px-3 py-2 font-semibold">By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((movement) => (
                    <tr key={movement.id} className="odd:bg-black/2">
                      <td className="px-3 py-2 text-xs text-black/70">
                        {new Date(movement.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-black">{movement.product?.name || "Unknown Product"}</p>
                        <p className="text-xs text-black/55">SKU: {movement.product?.sku || "-"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${movementTypeTone[movement.movementType]}`}
                        >
                          {movement.movementType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-black">
                        {formatSignedQty(movement.changeQty)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-black/85">
                        {movement.quantityAfter}
                      </td>
                      <td className="px-3 py-2 text-xs text-black/80">
                        <p>{movement.reason}</p>
                        {movement.note ? <p className="text-black/55">{movement.note}</p> : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-black/70">
                        {movement.createdBy?.name || movement.createdBy?.email || "System"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </section>
        )}
      </div>
    </AdminShell>
  );
}
