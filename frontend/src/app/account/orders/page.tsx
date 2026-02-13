"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Order } from "@/lib/types";

const formatStatus = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const response = await api.get("/orders");
        if (isActive) {
          setOrders(response.data.orders ?? []);
          setStatus("ready");
        }
      } catch {
        if (isActive) {
          setStatus("error");
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <NavBar />
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Your orders</h1>
        <p className="mt-2 text-sm text-black/60">
          Track the latest shipments and manage returns.
        </p>
        <div className="mt-8 grid gap-4">
          {orders.length > 0 ? (
            orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-black/10 bg-white p-5 md:flex-row md:items-center"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                    {`Order ${order.id.slice(0, 8)}`}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatDateShort(order.createdAt)}
                  </p>
                </div>
                <div className="text-sm text-black/60">
                  {formatCurrency(order.total, order.currency)}
                </div>
                <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold">
                  {formatStatus(order.status)}
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-sm text-black/60">
              {status === "error"
                ? "Sign in to view your orders."
                : "Loading orders..."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
