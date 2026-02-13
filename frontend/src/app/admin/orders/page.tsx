"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Order } from "@/lib/types";

const formatStatus = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function AdminOrdersPage() {
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
    <AdminShell title="Orders">
      <p className="text-sm text-black/60">
        Track fulfillment status and customer shipping activity.
      </p>
      <div className="mt-6 grid gap-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col justify-between gap-2 rounded-2xl border border-black/10 bg-white p-5 md:flex-row md:items-center"
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
              ? "Login as admin to load orders."
              : "Loading orders..."}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
