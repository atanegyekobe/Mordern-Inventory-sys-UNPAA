"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";

type Summary = {
  users: number;
  products: number;
  orders: number;
};

type StatCard = {
  label: string;
  value: number;
  tone: string;
  detail: string;
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
        setError("Sign in with a shop owner or admin account to load summary data.");
      }
    };

    load();
  }, []);

  const stats: StatCard[] = summary
    ? [
        {
          label: "Users",
          value: summary.users,
          tone: "from-amber-100 to-amber-50 border-amber-200/80",
          detail: "Registered accounts",
        },
        {
          label: "Products",
          value: summary.products,
          tone: "from-cyan-100 to-cyan-50 border-cyan-200/80",
          detail: "Live catalog entries",
        },
        {
          label: "Orders",
          value: summary.orders,
          tone: "from-emerald-100 to-emerald-50 border-emerald-200/80",
          detail: "Total processed orders",
        },
      ]
    : [];

  const quickActions = [
    {
      label: "Open POS",
      description: "Launch fast-sale mode for the counter.",
      href: "/admin/pos",
    },
    {
      label: "Review payments",
      description: "Handle rechecks, refunds, and overrides.",
      href: "/admin/payments",
    },
    {
      label: "Manage orders",
      description: "Track fulfillment and customer delivery states.",
      href: "/admin/orders",
    },
    {
      label: "Open analytics",
      description: "Inspect revenue, trends, and category performance.",
      href: "/admin/analytics",
    },
    {
      label: "Read messages",
      description: "Respond to customer support conversations.",
      href: "/admin/messages",
    },
  ];

  return (
    <AdminShell title="Admin overview">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,transparent_40%),radial-gradient(circle_at_top_right,#cffafe_0%,transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6">
        <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-cyan-200/35 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/50">
            Command Center
          </p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-black">
            Operational snapshot for today
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-black/65">
            Monitor your store health at a glance, then jump directly into high-impact workflows.
          </p>
        </div>

        <div className="relative mt-6 grid gap-5 md:grid-cols-3">
          {summary ? (
            stats.map((stat) => (
              <div
                key={stat.label}
                className={`group rounded-2xl border bg-linear-to-br ${stat.tone} p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.45)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]`}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-black/55">
                  {stat.label}
                </p>
                <p className="mt-3 text-4xl font-semibold text-black">{stat.value}</p>
                <p className="mt-2 text-xs text-black/60">{stat.detail}</p>
              </div>
            ))
          ) : (
            <div className="md:col-span-3">
              <div className="rounded-2xl border border-black/10 bg-white/85 p-5">
                <p className="text-sm text-black/65">{error || "Loading summary..."}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-black/55">
            Quick Actions
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-2xl border border-black/10 bg-white p-4 transition hover:border-black/25 hover:bg-black/2"
              >
                <p className="text-sm font-semibold text-black group-hover:underline">
                  {action.label}
                </p>
                <p className="mt-1 text-xs text-black/60">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-black/55">
            Data Sync Notes
          </h3>
          <div className="mt-3 rounded-2xl border border-dashed border-black/20 bg-black/2 p-5 text-sm text-black/65">
            Sync your live catalog and recent orders from the API once backend data is populated.
            <p className="mt-3 text-xs text-black/55">
              Tip: review Payments and Orders first after each deployment to catch reconciliation drift early.
            </p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
