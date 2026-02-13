"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";

type Summary = {
  users: number;
  products: number;
  orders: number;
};

export default function AdminOverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get("/admin/summary");
        setSummary(response.data);
      } catch {
        setError("Login as admin to load summary data.");
      }
    };

    load();
  }, []);

  return (
    <AdminShell title="Admin overview">
      <div className="grid gap-6 md:grid-cols-3">
        {summary ? (
          [
            { label: "Users", value: summary.users },
            { label: "Products", value: summary.products },
            { label: "Orders", value: summary.orders },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-black/10 bg-white p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                {stat.label}
              </p>
              <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
            </div>
          ))
        ) : (
          <div className="md:col-span-3">
            <p className="text-sm text-black/60">
              {error || "Loading summary..."}
            </p>
          </div>
        )}
      </div>
      <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-6 text-sm text-black/60">
        Sync your live catalog and recent orders from the API once backend data
        is populated.
      </div>
    </AdminShell>
  );
}
