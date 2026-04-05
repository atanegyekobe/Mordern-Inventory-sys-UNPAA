"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";

const PAGE_SIZE = 10;

type ObservabilityMetric = {
  name: string;
  tags: Record<string, string | number | boolean | null>;
  value: number;
};

type ObservabilitySnapshot = {
  timestamp: string;
  metrics: ObservabilityMetric[];
};

const getErrorStatus = (err: unknown): number | undefined => {
  if (typeof err !== "object" || err === null || !("response" in err)) {
    return undefined;
  }

  const response = (err as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : undefined;
};

const severityClass = (value: number, warningThreshold: number, criticalThreshold: number) => {
  if (value >= criticalThreshold) {
    return "text-red-700";
  }

  if (value >= warningThreshold) {
    return "text-amber-700";
  }

  return "text-emerald-700";
};

export default function AdminObservabilityPage() {
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSnapshot = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);
      const response = await api.get<ObservabilitySnapshot>("/sla-jobs/metrics");
      setSnapshot(response.data);
    } catch (err: unknown) {
      console.error("Failed to fetch observability snapshot:", err);

      const status = getErrorStatus(err);
      if (status === 401) {
        setError("Please login as admin to view observability metrics.");
      } else if (status === 403) {
        setError("Admin access is required to view observability metrics.");
      } else {
        setError("Failed to load observability metrics.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
  }, []);

  const getMetricTotal = (name: string) => {
    if (!snapshot?.metrics?.length) {
      return 0;
    }

    return snapshot.metrics
      .filter((metric) => metric.name === name)
      .reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  };

  const headlineMetrics = [
    {
      label: "Webhook Failures",
      value: getMetricTotal("payment.webhook.failures"),
      className: severityClass(getMetricTotal("payment.webhook.failures"), 1, 3),
    },
    {
      label: "Webhook Success",
      value: getMetricTotal("payment.webhook.success"),
      className: "text-emerald-700",
    },
    {
      label: "Reconciliation Errors",
      value: getMetricTotal("payment.reconciliation.errors_count"),
      className: severityClass(getMetricTotal("payment.reconciliation.errors_count"), 1, 2),
    },
    {
      label: "Reconciled Payments",
      value: getMetricTotal("payment.reconciliation.reconciled"),
      className: "text-blue-700",
    },
    {
      label: "Scheduler Lock Skips",
      value: getMetricTotal("scheduler.lock_skips"),
      className: severityClass(getMetricTotal("scheduler.lock_skips"), 2, 5),
    },
    {
      label: "Pending Payment Alerts",
      value: getMetricTotal("pending_payment.alerted_count"),
      className: severityClass(getMetricTotal("pending_payment.alerted_count"), 2, 4),
    },
  ];

  const sortedMetrics = useMemo(() => {
    if (!snapshot?.metrics?.length) {
      return [];
    }

    return [...snapshot.metrics].sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) {
        return byName;
      }

      return JSON.stringify(a.tags).localeCompare(JSON.stringify(b.tags));
    });
  }, [snapshot]);

  useEffect(() => {
    setCurrentPage(1);
  }, [snapshot?.timestamp]);

  const totalPages = Math.max(1, Math.ceil(sortedMetrics.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMetrics = sortedMetrics.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <AdminShell title="Operational observability">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">System health and reliability</h2>
            <p className="mt-1 text-sm text-slate-500">
              Monitor payment webhooks, reconciliation behavior, scheduler lock contention, and pending-payment alerts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchSnapshot(true)}
              disabled={refreshing}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              href="/admin/analytics"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Back to analytics
            </Link>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Last updated: {snapshot?.timestamp ? new Date(snapshot.timestamp).toLocaleString() : "N/A"}
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Loading observability metrics...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {headlineMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <p className={`mt-2 text-3xl font-bold ${metric.className}`}>{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold">Raw metric snapshot</h3>
              <p className="mt-1 text-sm text-slate-500">
                Full metric list from `GET /api/sla-jobs/metrics` for debugging and future dashboard expansion.
              </p>

              {sortedMetrics.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">No metrics have been recorded yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-180 border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="pb-3 font-semibold text-slate-700">Metric</th>
                        <th className="pb-3 font-semibold text-slate-700">Tags</th>
                        <th className="pb-3 font-semibold text-slate-700">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMetrics.map((metric, index) => (
                        <tr key={`${metric.name}-${index}`} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 font-medium text-slate-900">{metric.name}</td>
                          <td className="py-3 text-slate-600">
                            {Object.keys(metric.tags || {}).length > 0
                              ? Object.entries(metric.tags)
                                  .map(([key, value]) => `${key}=${String(value)}`)
                                  .join(", ")
                              : "-"}
                          </td>
                          <td className="py-3 font-semibold text-slate-900">{metric.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationControls
                totalItems={sortedMetrics.length}
                currentPage={safePage}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemLabel="metrics"
                className="mt-4"
              />
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
