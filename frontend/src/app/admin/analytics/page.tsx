"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import BackButton from "@/components/BackButton";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type Period = "day" | "week" | "month" | "year";

interface AnalyticsData {
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  overview: {
    revenue: number;
    orders: number;
    pendingOrders: number;
    customers: number;
    newCustomers: number;
    activeCustomers: number;
    offlineSales: number;
  };
  trends: {
    revenueChange: number;
    ordersChange: number;
    customersChange: number;
  };
  stockInsights: {
    lowStockCount: number;
    outOfStockCount: number;
  };
  topSellingProducts: Array<{
    ProductId: string;
    totalSold: number;
    totalRevenue: number;
    Product: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
  }>;
  categoryPerformance: Array<{
    totalSold: number;
    totalRevenue: number;
    Product: {
      Category: {
        id: string;
        name: string;
      };
    };
  }>;
  dailyBreakdown: Array<{
    date: string;
    salesCount: number;
    revenue: number;
    profit: number;
  }>;
  filteredMetrics: {
    salesCount: number;
    revenue: number;
    profit: number;
  };
  kpiTrends: {
    periodProfit: {
      current: number;
      previous: number;
      delta: number;
      deltaPct: number;
    };
  };
  filters: {
    applied?: {
      categoryId: string | null;
      productId: string | null;
      stockThreshold: number | null;
    };
    options?: {
      categories: Array<{ id: string; name: string }>;
      products: Array<{ id: string; name: string; CategoryId: string; stock: number }>;
    };
    categories: Array<{ id: string; name: string }>;
    products: Array<{ id: string; name: string; CategoryId: string; stock: number }>;
  };
  generatedAt?: string;
}

interface LowStockAlertsData {
  lowStock: {
    critical: Array<{ id: string; name: string; stock: number }>;
    warning: Array<{ id: string; name: string; stock: number }>;
    threshold: number;
    count: number;
  };
}

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "day", label: "Today" },
  { value: "week", label: "7 Days" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [lowStock, setLowStock] = useState<LowStockAlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [filterStockThreshold, setFilterStockThreshold] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    categoryId: "",
    productId: "",
    stockThreshold: "",
  });

  const getErrorStatus = (err: unknown): number | undefined => {
    if (typeof err !== "object" || err === null || !("response" in err)) {
      return undefined;
    }
    const response = (err as { response?: { status?: unknown } }).response;
    return typeof response?.status === "number" ? response.status : undefined;
  };

  const fetchAnalytics = async (manualRefresh = false) => {
    try {
      if (manualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const query = new URLSearchParams({ period });
      if (appliedFilters.categoryId) query.set("categoryId", appliedFilters.categoryId);
      if (appliedFilters.productId) query.set("productId", appliedFilters.productId);
      if (appliedFilters.stockThreshold) query.set("stockThreshold", appliedFilters.stockThreshold);

      const [analyticsResponse, lowStockResponse] = await Promise.all([
        api.get<AnalyticsData>(`/admin/analytics?${query.toString()}`),
        api.get<LowStockAlertsData>("/admin/low-stock-alerts"),
      ]);

      setAnalytics(analyticsResponse.data);
      setLowStock(lowStockResponse.data);
      setLastSyncedAt(analyticsResponse.data?.generatedAt || new Date().toISOString());
    } catch (err: unknown) {
      console.error("Failed to fetch inventory analytics:", err);
      if (getErrorStatus(err) === 401) {
        setError("Please login as admin to view inventory analytics");
        setTimeout(() => router.push("/login"), 1200);
      } else {
        setError("Failed to load inventory analytics data");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, appliedFilters]);

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Not synced yet";
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? "Not synced yet" : dt.toLocaleString();
  };

  const trendTone = (value: number) => {
    if (value > 0) return "text-emerald-700";
    if (value < 0) return "text-rose-700";
    return "text-black/60";
  };

  const formatTrend = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

  const stockSummary = useMemo(() => {
    const criticalCount = lowStock?.lowStock.critical.length ?? 0;
    const warningCount = lowStock?.lowStock.warning.length ?? 0;
    return {
      criticalCount,
      warningCount,
      threshold: lowStock?.lowStock.threshold ?? 5,
    };
  }, [lowStock]);

  const categoryOptions = analytics?.filters?.options?.categories ?? analytics?.filters?.categories ?? [];
  const productOptions = analytics?.filters?.options?.products ?? analytics?.filters?.products ?? [];
  const filteredProductOptions = filterCategoryId
    ? productOptions.filter((product) => product.CategoryId === filterCategoryId)
    : productOptions;
  const hasActiveFilters = Boolean(
    appliedFilters.categoryId || appliedFilters.productId || appliedFilters.stockThreshold
  );

  const applyFilters = () => {
    setAppliedFilters({
      categoryId: filterCategoryId,
      productId: filterProductId,
      stockThreshold: filterStockThreshold.trim(),
    });
  };

  const clearFilters = () => {
    setFilterCategoryId("");
    setFilterProductId("");
    setFilterStockThreshold("");
    setAppliedFilters({ categoryId: "", productId: "", stockThreshold: "" });
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-live="polite">
        <div className="h-20 animate-pulse rounded-2xl bg-black/5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="h-28 animate-pulse rounded-2xl bg-black/5" />
          <div className="h-28 animate-pulse rounded-2xl bg-black/5" />
          <div className="h-28 animate-pulse rounded-2xl bg-black/5" />
          <div className="h-28 animate-pulse rounded-2xl bg-black/5" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-black/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700" role="alert" aria-live="assertive">{error}</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <p className="text-red-700">Unable to load inventory analytics.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 p-4 md:p-6"
    >
      <BackButton />

      <div className="rounded-3xl border border-black/10 bg-linear-to-r from-sky-50 via-white to-emerald-50 p-5 shadow-sm md:p-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(290px,auto)] md:items-center">
          <div>
            <p className="inline-flex rounded-full border border-sky-200 bg-sky-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
              Inventory Intelligence
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-black md:text-3xl">Analytics Hub</h1>
            <p className="mt-1 text-sm text-black/65">Track stock health, movement velocity, and catalog readiness from one control surface.</p>
            <p className="mt-2 text-xs font-medium text-black/55">Last sync: {formatLastSync(lastSyncedAt)}</p>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/90 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">Period</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-black/10 bg-white p-1 sm:grid-cols-4" role="group" aria-label="Select analytics period">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  aria-pressed={period === option.value}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                    period === option.value ? "bg-black text-white shadow-sm" : "text-black/70 hover:bg-black/5"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => fetchAnalytics(true)}
              className="mt-3 w-full rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
            >
              {isRefreshing ? "Refreshing..." : "Refresh now"}
            </button>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                value={filterCategoryId}
                onChange={(e) => {
                  setFilterCategoryId(e.target.value);
                  setFilterProductId("");
                }}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black"
              >
                <option value="">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select
                value={filterProductId}
                onChange={(e) => setFilterProductId(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black"
              >
                <option value="">All products</option>
                {filteredProductOptions.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Stock <="
                value={filterStockThreshold}
                onChange={(e) => setFilterStockThreshold(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyFilters}
                  className="w-full rounded-xl border border-black/15 bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-black/85"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-black/3"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700/70">Period Revenue</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{formatCurrency(analytics.overview.revenue ?? 0)}</p>
          <p className={`mt-2 text-xs font-semibold ${trendTone(analytics.trends.revenueChange)}`}>
            {formatTrend(analytics.trends.revenueChange)} vs previous period
          </p>
        </article>

        <article className="rounded-2xl border border-sky-200/70 bg-sky-50/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700/70">Stock Movements</p>
          <p className="mt-2 text-3xl font-semibold text-sky-700">{analytics.overview.offlineSales ?? 0}</p>
          <p className={`mt-2 text-xs font-semibold ${trendTone(analytics.trends.ordersChange)}`}>
            {formatTrend(analytics.trends.ordersChange)} velocity trend
          </p>
        </article>

        <article className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700/70">Active Customers</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{analytics.overview.activeCustomers ?? 0}</p>
          <p className={`mt-2 text-xs font-semibold ${trendTone(analytics.trends.customersChange)}`}>
            {formatTrend(analytics.trends.customersChange)} participation trend
          </p>
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Catalog Coverage</p>
          <p className="mt-2 text-3xl font-semibold text-black">{analytics.filters.products.length}</p>
          <p className="mt-2 text-xs font-semibold text-black/55">Across {analytics.filters.categories.length} categories</p>
        </article>
      </section>

      {hasActiveFilters && (
        <section className="rounded-2xl border border-black/10 bg-black/2 p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-black/55">Filtered Snapshot</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Movements</p>
              <p className="mt-1 text-2xl font-semibold text-black">{analytics.filteredMetrics.salesCount}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-sky-700">{formatCurrency(analytics.filteredMetrics.revenue)}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Profit</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatCurrency(analytics.filteredMetrics.profit)}</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-black">Daily Movement Breakdown</h2>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">{analytics.dailyBreakdown.length} day rows</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-black/10">
            <table className="min-w-full text-sm">
              <thead className="bg-black/3">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Movements</th>
                  <th className="px-4 py-3 font-semibold">Revenue</th>
                  <th className="px-4 py-3 font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody>
                {analytics.dailyBreakdown.length > 0 ? (
                  analytics.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="border-t border-black/8">
                      <td className="px-4 py-3">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-semibold">{row.salesCount}</td>
                      <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">{formatCurrency(row.profit)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-center text-black/55">No daily movement data in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-black">Profit Trend</h2>
          <p className="mt-1 text-sm text-black/60">Period-over-period profitability signal for inventory operations.</p>
          <p className={`mt-3 text-3xl font-semibold ${trendTone(analytics.kpiTrends.periodProfit.deltaPct)}`}>
            {formatTrend(analytics.kpiTrends.periodProfit.deltaPct)}
          </p>
          <p className="mt-2 text-sm text-black/65">Delta: {formatCurrency(analytics.kpiTrends.periodProfit.delta)}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-black">Top Moving Products</h2>
          <div className="mt-3 space-y-2">
            {analytics.topSellingProducts.length > 0 ? (
              analytics.topSellingProducts.slice(0, 8).map((row) => (
                <div key={row.ProductId} className="flex items-center justify-between rounded-lg border border-black/10 bg-black/2 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-black">{row.Product?.name || "Unknown"}</p>
                    <p className="text-xs text-black/55">{row.totalSold} units moved</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">{formatCurrency(row.totalRevenue)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-black/55">No product movement data for this period.</p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-black">Category Performance</h2>
          <div className="mt-3 space-y-2">
            {analytics.categoryPerformance.length > 0 ? (
              analytics.categoryPerformance.slice(0, 8).map((row) => (
                <div key={row.Product.Category.id} className="flex items-center justify-between rounded-lg border border-black/10 bg-black/2 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-black">{row.Product.Category.name}</p>
                    <p className="text-xs text-black/55">{row.totalSold} units moved</p>
                  </div>
                  <span className="text-sm font-semibold text-sky-700">{formatCurrency(row.totalRevenue)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-black/55">No category performance data for this period.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-black">Stock Health</h2>
          <p className="mt-1 text-sm text-black/60">Threshold alerting is set at {stockSummary.threshold} units.</p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">Out of Stock</p>
              <p className="mt-1 text-2xl font-semibold text-red-700">{analytics.stockInsights.outOfStockCount}</p>
            </div>
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-yellow-700">Low Stock</p>
              <p className="mt-1 text-2xl font-semibold text-yellow-700">{analytics.stockInsights.lowStockCount}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Total At Risk</p>
              <p className="mt-1 text-2xl font-semibold text-black">{stockSummary.criticalCount + stockSummary.warningCount}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Critical Items</p>
              <ul className="mt-2 space-y-2 text-sm text-black/75">
                {(lowStock?.lowStock.critical ?? []).slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-lg border border-black/10 bg-black/2 px-3 py-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{item.stock}</span>
                  </li>
                ))}
                {(lowStock?.lowStock.critical?.length ?? 0) === 0 && <li className="text-black/55">No critical stock-outs right now.</li>}
              </ul>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Warning Items</p>
              <ul className="mt-2 space-y-2 text-sm text-black/75">
                {(lowStock?.lowStock.warning ?? []).slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-lg border border-black/10 bg-black/2 px-3 py-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">{item.stock}</span>
                  </li>
                ))}
                {(lowStock?.lowStock.warning?.length ?? 0) === 0 && <li className="text-black/55">No warning-level products right now.</li>}
              </ul>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-black">Catalog Readiness</h2>
          <p className="mt-1 text-sm text-black/60">Use this snapshot before receiving, replenishment, and weekly stock review.</p>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/2 px-4 py-3">
              <span className="text-sm text-black/60">Period</span>
              <span className="text-sm font-semibold text-black">{analytics.period}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/2 px-4 py-3">
              <span className="text-sm text-black/60">Categories</span>
              <span className="text-sm font-semibold text-black">{analytics.filters.categories.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/2 px-4 py-3">
              <span className="text-sm text-black/60">Products</span>
              <span className="text-sm font-semibold text-black">{analytics.filters.products.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/2 px-4 py-3">
              <span className="text-sm text-black/60">Date Window</span>
              <span className="text-right text-xs font-semibold text-black/75">
                {new Date(analytics.dateRange.startDate).toLocaleDateString()} to {new Date(analytics.dateRange.endDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </article>
      </section>
    </motion.div>
  );
}
