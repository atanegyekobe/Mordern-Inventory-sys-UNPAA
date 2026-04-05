"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import BackButton from "@/components/BackButton";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toAssetUrl } from "@/lib/assets";

const PAGE_SIZE = 10;

interface AnalyticsData {
  revenue: {
    total: string | number;
    period: string | number;
    avgOrderValue: string | number;
  };
  orders: {
    total: number;
    period: number;
    pending: number;
  };
  customers: {
    total: number;
    new: number;
    active: number;
  };
  products: {
    topSelling: Array<{
      ProductId: string;
      totalSold: number;
      totalRevenue: string | number;
      Product: {
        id: string;
        name: string;
        imageUrl: string;
      };
    }>;
    categoryPerformance: Array<{
      totalSold: number;
      totalRevenue: string | number;
      Product: {
        Category: {
          id: string;
          name: string;
        };
      };
    }>;
    lowStock: Array<{
      id: string;
      name: string;
      stock: number;
      price: string | number;
      imageUrl: string;
      Category: {
        id: string;
        name: string;
      };
    }>;
    critical: Array<{
      id: string;
      name: string;
      stock: number;
    }>;
  };
  dailyBreakdown: Array<{
    date: string;
    salesCount: number;
    revenue: string | number;
    profit: string | number;
  }>;
  filteredMetrics: {
    salesCount: number;
    revenue: string | number;
    profit: string | number;
  };
  filters: {
    applied: {
      categoryId: string | null;
      productId: string | null;
      stockThreshold: number | null;
    };
    options: {
      categories: Array<{
        id: string;
        name: string;
      }>;
      products: Array<{
        id: string;
        name: string;
        CategoryId: string;
        stock: number;
      }>;
    };
  };
  kpiTrends: {
    periodRevenue: {
      current: number;
      previous: number;
      delta: number;
      deltaPct: number;
    };
    periodOrders: {
      current: number;
      previous: number;
      delta: number;
      deltaPct: number;
    };
    periodProfit: {
      current: number;
      previous: number;
      delta: number;
      deltaPct: number;
    };
  };
  generatedAt?: string;
  period: string;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topSellingPage, setTopSellingPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [criticalPage, setCriticalPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [selectedBreakdownDate, setSelectedBreakdownDate] = useState("all");
  const [breakdownView, setBreakdownView] = useState<"popup" | "table">("popup");
  const [revenueSnapshotView, setRevenueSnapshotView] = useState<"cards" | "table">("cards");
  const [activeTab, setActiveTab] = useState<"payments" | "commerce" | "operations">("payments");
  const [showBreakdownPopup, setShowBreakdownPopup] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
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

  const fetchAnalytics = async (isManualRefresh = false) => {
    try {
      if (period === "custom" && (!customStartDate || !customEndDate)) {
        setLoading(false);
        return;
      }

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);
      const query = new URLSearchParams({ period });
      if (period === "custom") {
        query.set("startDate", customStartDate);
        query.set("endDate", customEndDate);
      }
      if (appliedFilters.categoryId) query.set("categoryId", appliedFilters.categoryId);
      if (appliedFilters.productId) query.set("productId", appliedFilters.productId);
      if (appliedFilters.stockThreshold) query.set("stockThreshold", appliedFilters.stockThreshold);

      const response = await api.get(`/admin/analytics?${query.toString()}`);
      setAnalytics(response.data);
      setLastSyncedAt(response.data?.generatedAt || new Date().toISOString());
    } catch (err: unknown) {
      console.error("Failed to fetch analytics:", err);
      if (getErrorStatus(err) === 401) {
        setError("Please login as admin to view analytics");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError("Failed to load analytics data");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, appliedFilters, customStartDate, customEndDate]);

  useEffect(() => {
    setTopSellingPage(1);
    setCategoryPage(1);
    setCriticalPage(1);
    setLowStockPage(1);
  }, [analytics]);

  useEffect(() => {
    if (!showBreakdownPopup) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowBreakdownPopup(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [showBreakdownPopup]);

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-busy="true" aria-live="polite">
        <div className="h-20 animate-pulse rounded-2xl bg-black/5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <p className="text-red-600" role="alert" aria-live="assertive">{error}</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <p className="text-red-600">Failed to load analytics data.</p>
      </div>
    );
  }

  const topSelling = analytics.products?.topSelling ?? [];
  const categoryPerformance = analytics.products?.categoryPerformance ?? [];
  const criticalProducts = analytics.products?.critical ?? [];
  const lowStockProducts = analytics.products?.lowStock ?? [];
  const dailyBreakdown = analytics.dailyBreakdown ?? [];
  const filterCategories = analytics.filters?.options?.categories ?? [];
  const filterProducts = analytics.filters?.options?.products ?? [];
  const filteredMetrics = analytics.filteredMetrics ?? { salesCount: 0, revenue: 0, profit: 0 };

  const hasActiveFilters = Boolean(
    appliedFilters.categoryId || appliedFilters.productId || appliedFilters.stockThreshold
  );
  const customRangeIncomplete = period === "custom" && (!customStartDate || !customEndDate);
  const periodOptions: Array<{ value: string; label: string }> = [
    { value: "day", label: "Today" },
    { value: "week", label: "7 Days" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
    { value: "custom", label: "Custom" },
  ];

  const topSellingTotalPages = Math.max(1, Math.ceil(topSelling.length / PAGE_SIZE));
  const safeTopSellingPage = Math.min(topSellingPage, topSellingTotalPages);
  const paginatedTopSelling = topSelling.slice((safeTopSellingPage - 1) * PAGE_SIZE, safeTopSellingPage * PAGE_SIZE);

  const categoryTotalPages = Math.max(1, Math.ceil(categoryPerformance.length / PAGE_SIZE));
  const safeCategoryPage = Math.min(categoryPage, categoryTotalPages);
  const paginatedCategories = categoryPerformance.slice((safeCategoryPage - 1) * PAGE_SIZE, safeCategoryPage * PAGE_SIZE);

  const criticalTotalPages = Math.max(1, Math.ceil(criticalProducts.length / PAGE_SIZE));
  const safeCriticalPage = Math.min(criticalPage, criticalTotalPages);
  const paginatedCritical = criticalProducts.slice((safeCriticalPage - 1) * PAGE_SIZE, safeCriticalPage * PAGE_SIZE);

  const lowStockTotalPages = Math.max(1, Math.ceil(lowStockProducts.length / PAGE_SIZE));
  const safeLowStockPage = Math.min(lowStockPage, lowStockTotalPages);
  const paginatedLowStock = lowStockProducts.slice((safeLowStockPage - 1) * PAGE_SIZE, safeLowStockPage * PAGE_SIZE);

  const filteredDailyBreakdown = selectedBreakdownDate === "all"
    ? dailyBreakdown
    : dailyBreakdown.filter((row) => row.date === selectedBreakdownDate);

  const paymentsBadgeCount = dailyBreakdown.length;
  const commerceBadgeCount = topSelling.length + categoryPerformance.length;
  const operationsBadgeCount = lowStockProducts.length;

  const panelClass =
    "rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_34px_-26px_rgba(0,0,0,0.45)]";

  const revenueSnapshotRows: Array<{ metric: string; value: string | number; tone?: string }> = [
    { metric: "Total Revenue", value: analytics.revenue?.total ?? 0, tone: "text-emerald-700" },
    { metric: "Period Revenue", value: analytics.revenue?.period ?? 0, tone: "text-sky-700" },
    { metric: "Avg Order Value", value: analytics.revenue?.avgOrderValue ?? 0, tone: "text-amber-700" },
    ...(hasActiveFilters
      ? [
          { metric: "Filtered Sales", value: filteredMetrics.salesCount, tone: "text-black" },
          { metric: "Filtered Revenue", value: filteredMetrics.revenue, tone: "text-sky-700" },
          { metric: "Filtered Profit", value: filteredMetrics.profit, tone: "text-emerald-700" },
        ]
      : []),
  ];

  const formatDayLabel = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const buildDailyCsv = (rows: AnalyticsData["dailyBreakdown"]) => {
    const header = ["Date", "Sales", "Revenue", "Profit"];
    const lines = rows.map((row) => [
      row.date,
      String(row.salesCount),
      String(Number(row.revenue || 0)),
      String(Number(row.profit || 0)),
    ]);
    return [header, ...lines].map((line) => line.join(",")).join("\n");
  };

  const buildTopSellingCsv = () => {
    const header = ["Product", "Units Sold", "Revenue"];
    const lines = topSelling.map((row) => [
      row.Product?.name || "Unknown",
      String(Number(row.totalSold || 0)),
      String(Number(row.totalRevenue || 0)),
    ]);
    return [header, ...lines].map((line) => line.join(",")).join("\n");
  };

  const buildCategoryCsv = () => {
    const header = ["Category", "Units Sold", "Revenue"];
    const lines = categoryPerformance.map((row) => [
      row.Product?.Category?.name || "Unknown",
      String(Number(row.totalSold || 0)),
      String(Number(row.totalRevenue || 0)),
    ]);
    return [header, ...lines].map((line) => line.join(",")).join("\n");
  };

  const downloadDailyBreakdownCsv = () => {
    if (!filteredDailyBreakdown.length) return;
    downloadCsv(`daily-breakdown-${period}-${new Date().toISOString().slice(0, 10)}.csv`, buildDailyCsv(filteredDailyBreakdown));
  };

  const downloadTopSellingCsv = () => {
    if (!topSelling.length) return;
    downloadCsv(`top-selling-${period}-${new Date().toISOString().slice(0, 10)}.csv`, buildTopSellingCsv());
  };

  const downloadCategoryCsv = () => {
    if (!categoryPerformance.length) return;
    downloadCsv(`category-performance-${period}-${new Date().toISOString().slice(0, 10)}.csv`, buildCategoryCsv());
  };

  const saveDailyBreakdownSnapshot = () => {
    const snapshot = {
      id: `${Date.now()}`,
      period,
      selectedBreakdownDate,
      createdAt: new Date().toISOString(),
      rows: filteredDailyBreakdown,
    };
    const key = "analyticsDailyBreakdownSnapshots";
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    localStorage.setItem(key, JSON.stringify([snapshot, ...existing].slice(0, 30)));
    setSaveMessage("Saved breakdown snapshot to this browser.");
    setTimeout(() => setSaveMessage(null), 2500);
  };

  const applyAnalyticsFilters = () => {
    setAppliedFilters({
      categoryId: filterCategoryId,
      productId: filterProductId,
      stockThreshold: filterStockThreshold.trim(),
    });
  };

  const clearAnalyticsFilters = () => {
    setFilterCategoryId("");
    setFilterProductId("");
    setFilterStockThreshold("");
    setAppliedFilters({ categoryId: "", productId: "", stockThreshold: "" });
  };

  const formatDelta = (deltaPct: number) => `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`;
  const formatSignedNumber = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value)}`;
  const formatSignedCurrency = (value: number) => `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
  const trendTone = (deltaPct: number) => {
    if (deltaPct > 0) return "text-emerald-700";
    if (deltaPct < 0) return "text-rose-700";
    return "text-black/60";
  };
  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Not synced yet";
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? "Not synced yet" : dt.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 p-4 md:p-6"
    >
      <BackButton />

      <div className="rounded-3xl border border-black/10 bg-linear-to-r from-sky-50 via-white to-amber-50 p-5 shadow-sm md:p-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,auto)] md:items-center">
          <div>
            <p className="inline-flex rounded-full border border-sky-200 bg-sky-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
              Operations Dashboard
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-black md:text-3xl">Analytics</h1>
            <p className="mt-1 text-sm text-black/65">Revenue, customer growth, and product performance in one connected view.</p>
            <p className="mt-2 text-xs font-medium text-black/55">Last sync: {formatLastSync(lastSyncedAt)}</p>
          </div>

          <div className="w-full rounded-2xl border border-black/10 bg-white/90 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">Period</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-black/10 bg-white p-1 sm:grid-cols-5" role="group" aria-label="Select analytics period">
                  {periodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPeriod(option.value)}
                      aria-pressed={period === option.value}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                        period === option.value
                          ? "bg-black text-white shadow-sm"
                          : "text-black/70 hover:bg-black/5"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {period === "custom" && (
                <>
                  <div>
                    <label htmlFor="custom-start-date" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">Start Date</label>
                    <input
                      id="custom-start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-end-date" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">End Date</label>
                    <input
                      id="custom-end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="filter-category" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">Category</label>
                <select
                  id="filter-category"
                  value={filterCategoryId}
                  onChange={(e) => {
                    setFilterCategoryId(e.target.value);
                    setFilterProductId("");
                  }}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                >
                  <option value="">All Categories</option>
                  {filterCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-product" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55">Product</label>
                <select
                  id="filter-product"
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                >
                  <option value="">All Products</option>
                  {filterProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-stock" className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-black/55">Stock Threshold (&lt;=)</label>
                <input
                  id="filter-stock"
                  type="number"
                  min={0}
                  step={1}
                  value={filterStockThreshold}
                  onChange={(e) => setFilterStockThreshold(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchAnalytics(true)}
                aria-label="Refresh analytics data"
                className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                type="button"
                onClick={applyAnalyticsFilters}
                aria-label="Apply analytics filters"
                className="rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={clearAnalyticsFilters}
                aria-label="Clear analytics filters"
                className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
              >
                Clear filters
              </button>
            </div>

            {customRangeIncomplete && (
              <p className="mt-2 text-xs font-medium text-amber-700">Select both start and end dates to load custom range analytics.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/95 p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { key: "payments", label: "Payments", badge: paymentsBadgeCount, badgeTone: "bg-sky-100 text-sky-800" },
            { key: "commerce", label: "Commerce", badge: commerceBadgeCount, badgeTone: "bg-emerald-100 text-emerald-800" },
            { key: "operations", label: "Operations", badge: operationsBadgeCount, badgeTone: "bg-rose-100 text-rose-800" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as "payments" | "commerce" | "operations")}
              className={`flex items-center justify-between rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key ? "bg-black text-white" : "text-black/70 hover:bg-black/5"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : tab.badgeTone
                }`}
              >
                {tab.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/95 p-4 shadow-sm md:p-6">
        <div className="space-y-8">
          {activeTab === "payments" && (
            <>
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-black/55">Revenue Snapshot</h2>
                  <div className="inline-flex rounded-xl border border-black/10 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setRevenueSnapshotView("cards")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        revenueSnapshotView === "cards" ? "bg-black text-white" : "text-black/70 hover:bg-black/5"
                      }`}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevenueSnapshotView("table")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        revenueSnapshotView === "table" ? "bg-black text-white" : "text-black/70 hover:bg-black/5"
                      }`}
                    >
                      Table
                    </button>
                  </div>
                </div>

                {revenueSnapshotView === "cards" ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-6 shadow-sm">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/70">Total Revenue</h3>
                      <p className="text-3xl font-semibold text-emerald-700">{formatCurrency(analytics.revenue?.total ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 p-6 shadow-sm">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700/70">Period Revenue</h3>
                      <p className="text-3xl font-semibold text-sky-700">{formatCurrency(analytics.revenue?.period ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-6 shadow-sm">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700/70">Avg Order Value</h3>
                      <p className="text-3xl font-semibold text-amber-700">{formatCurrency(analytics.revenue?.avgOrderValue ?? 0)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-black/3">
                        <tr className="text-left">
                          <th scope="col" className="px-4 py-3 font-semibold">Metric</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueSnapshotRows.map((row) => (
                          <tr key={row.metric} className="border-t border-black/8 hover:bg-black/2">
                            <td className="px-4 py-3 font-medium">{row.metric}</td>
                            <td className={`px-4 py-3 font-semibold ${row.tone ?? "text-black"}`}>
                              {row.metric === "Filtered Sales" ? row.value : formatCurrency(row.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-black/2 p-3 md:grid-cols-3">
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-black/55">Revenue Trend</p>
                    <p className={`mt-1 text-sm font-semibold ${trendTone(analytics.kpiTrends.periodRevenue.deltaPct)}`}>
                      {formatDelta(analytics.kpiTrends.periodRevenue.deltaPct)} ({formatSignedCurrency(analytics.kpiTrends.periodRevenue.delta)})
                    </p>
                    <p className="mt-1 text-xs text-black/55">vs previous period</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-black/55">Orders Trend</p>
                    <p className={`mt-1 text-sm font-semibold ${trendTone(analytics.kpiTrends.periodOrders.deltaPct)}`}>
                      {formatDelta(analytics.kpiTrends.periodOrders.deltaPct)} ({formatSignedNumber(analytics.kpiTrends.periodOrders.delta)})
                    </p>
                    <p className="mt-1 text-xs text-black/55">vs previous period</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-black/55">Profit Trend</p>
                    <p className={`mt-1 text-sm font-semibold ${trendTone(analytics.kpiTrends.periodProfit.deltaPct)}`}>
                      {formatDelta(analytics.kpiTrends.periodProfit.deltaPct)} ({formatSignedCurrency(analytics.kpiTrends.periodProfit.delta)})
                    </p>
                    <p className="mt-1 text-xs text-black/55">vs previous period</p>
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="grid grid-cols-1 gap-4 rounded-2xl border border-black/10 bg-black/2 p-4 md:grid-cols-3">
                    <div className="rounded-xl border border-black/10 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Filtered Sales</p>
                      <p className="mt-2 text-2xl font-semibold text-black">{filteredMetrics.salesCount}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Filtered Revenue</p>
                      <p className="mt-2 text-2xl font-semibold text-sky-700">{formatCurrency(filteredMetrics.revenue)}</p>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Filtered Profit</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(filteredMetrics.profit)}</p>
                    </div>
                  </div>
                )}
              </section>

              <div className="h-px bg-black/10" />

              <section className={panelClass}>
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Daily Breakdown</h2>
                    <p className="mt-1 text-sm text-black/60">Select a day to review sales, revenue, and profit.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:min-w-105">
                    <div>
                      <label htmlFor="breakdown-date" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-black/55">Date</label>
                      <select
                        id="breakdown-date"
                        value={selectedBreakdownDate}
                        onChange={(e) => setSelectedBreakdownDate(e.target.value)}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                      >
                        <option value="all">All Days</option>
                        {dailyBreakdown.map((row) => (
                          <option key={row.date} value={row.date}>{formatDayLabel(row.date)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="breakdown-view" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-black/55">View Mode</label>
                      <select
                        id="breakdown-view"
                        value={breakdownView}
                        onChange={(e) => setBreakdownView(e.target.value as "popup" | "table")}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                      >
                        <option value="popup">Popup</option>
                        <option value="table">Table</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {breakdownView === "popup" && (
                    <button
                      type="button"
                      onClick={() => setShowBreakdownPopup(true)}
                      aria-label="Open daily breakdown popup"
                      className="rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
                    >
                      Open breakdown popup
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={saveDailyBreakdownSnapshot}
                    aria-label="Save daily breakdown snapshot"
                    className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                  >
                    Save snapshot
                  </button>
                  <button
                    type="button"
                    onClick={downloadDailyBreakdownCsv}
                    aria-label="Download daily breakdown CSV"
                    className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                  >
                    Download CSV
                  </button>
                  {saveMessage && <p className="text-sm text-green-700" aria-live="polite">{saveMessage}</p>}
                </div>

                {breakdownView === "table" && (
                  <div className="mt-5 overflow-x-auto rounded-xl border border-black/10">
                    <table className="min-w-full bg-white text-sm">
                      <thead className="bg-black/3">
                        <tr className="text-left">
                          <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Sales</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Revenue</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDailyBreakdown.length > 0 ? (
                          filteredDailyBreakdown.map((row) => (
                            <tr key={row.date} className="border-t border-black/8 hover:bg-black/2">
                              <td className="px-4 py-3">{formatDayLabel(row.date)}</td>
                              <td className="px-4 py-3 font-semibold">{row.salesCount}</td>
                              <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                              <td className="px-4 py-3 font-semibold text-emerald-700">{formatCurrency(row.profit)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-5 text-center text-black/55">No daily breakdown data for this selection.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "commerce" && (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className={panelClass}>
                  <h2 className="mb-4 text-xl font-semibold">Orders</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-black/60">Total Orders:</span><span className="font-semibold">{analytics.orders?.total ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-black/60">Period Orders:</span><span className="font-semibold">{analytics.orders?.period ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-black/60">Pending Orders:</span><span className="font-semibold text-orange-600">{analytics.orders?.pending ?? 0}</span></div>
                  </div>
                </div>
                <div className={panelClass}>
                  <h2 className="mb-4 text-xl font-semibold">Customers</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-black/60">Total Customers:</span><span className="font-semibold">{analytics.customers?.total ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-black/60">New Customers:</span><span className="font-semibold text-green-600">{analytics.customers?.new ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-black/60">Active Customers:</span><span className="font-semibold text-blue-600">{analytics.customers?.active ?? 0}</span></div>
                  </div>
                </div>
              </section>

              <div className="h-px bg-black/10" />

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className={panelClass}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Top Selling Products</h2>
                    <button
                      type="button"
                      onClick={downloadTopSellingCsv}
                      aria-label="Export top selling products to CSV"
                      className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/3"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="space-y-4">
                    {topSelling.length > 0 ? (
                      paginatedTopSelling.map((product) => (
                        <div key={product.ProductId} className="flex items-center justify-between rounded-xl border border-black/10 bg-black/2 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:bg-black/4">
                          <div className="flex items-center space-x-4">
                            {product.Product.imageUrl && (
                              <Image
                                src={toAssetUrl(product.Product.imageUrl)}
                                alt={product.Product.name}
                                width={48}
                                height={48}
                                unoptimized
                                className="h-12 w-12 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium">{product.Product.name}</p>
                              <p className="text-sm text-black/55">Sold: {product.totalSold} units</p>
                            </div>
                          </div>
                          <p className="font-semibold text-green-600">{formatCurrency(product.totalRevenue)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-black/55">No sales data for this period</p>
                    )}
                  </div>
                  <PaginationControls
                    totalItems={topSelling.length}
                    currentPage={safeTopSellingPage}
                    pageSize={PAGE_SIZE}
                    onPageChange={setTopSellingPage}
                    itemLabel="products"
                    className="mt-4"
                  />
                </div>

                <div className={panelClass}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Category Performance</h2>
                    <button
                      type="button"
                      onClick={downloadCategoryCsv}
                      aria-label="Export category performance to CSV"
                      className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/3"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="space-y-3">
                    {categoryPerformance.length > 0 ? (
                      paginatedCategories.map((cat) => (
                        <div key={cat.Product.Category.id} className="flex items-center justify-between rounded-xl border border-black/10 bg-black/2 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:bg-black/4">
                          <div>
                            <p className="font-medium">{cat.Product.Category.name}</p>
                            <p className="text-sm text-black/55">Units sold: {cat.totalSold}</p>
                          </div>
                          <p className="font-semibold text-green-600">{formatCurrency(cat.totalRevenue)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-black/55">No category data for this period</p>
                    )}
                  </div>
                  <PaginationControls
                    totalItems={categoryPerformance.length}
                    currentPage={safeCategoryPage}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCategoryPage}
                    itemLabel="categories"
                    className="mt-4"
                  />
                </div>
              </section>
            </>
          )}

          {activeTab === "operations" && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-26px_rgba(0,0,0,0.45)]">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><span className="text-red-600">⚠️</span> Restock Needed</h2>
              {criticalProducts.length > 0 && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-red-800">🚨 Critical - Out of Stock ({criticalProducts.length})</p>
                  {paginatedCritical.map((product) => (
                    <p key={product.id} className="text-xs text-red-700">• {product.name}</p>
                  ))}
                  <PaginationControls
                    totalItems={criticalProducts.length}
                    currentPage={safeCriticalPage}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCriticalPage}
                    itemLabel="critical products"
                    className="mt-3"
                  />
                </div>
              )}
              {lowStockProducts.length > 0 ? (
                <div className="space-y-2">
                  <p className="mb-3 text-sm text-black/60">
                    {lowStockProducts.length} product{lowStockProducts.length !== 1 ? "s" : ""} below threshold ({analytics?.filters?.applied?.stockThreshold ?? 5} units)
                  </p>
                  {paginatedLowStock.map((product) => (
                    <div key={product.id} className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-2 transition-colors hover:bg-yellow-100">
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-black/55">{product.Category?.name}</p>
                      </div>
                      <span className={`rounded px-2 py-1 text-sm font-semibold ${product.stock === 0 ? "bg-red-200 text-red-800" : "bg-yellow-200 text-yellow-800"}`}>
                        {product.stock} units
                      </span>
                    </div>
                  ))}
                  <PaginationControls
                    totalItems={lowStockProducts.length}
                    currentPage={safeLowStockPage}
                    pageSize={PAGE_SIZE}
                    onPageChange={setLowStockPage}
                    itemLabel="low-stock products"
                    className="mt-3"
                  />
                </div>
              ) : (
                <p className="py-4 text-center text-black/55">All products well stocked ✓</p>
              )}
            </section>
          )}
        </div>
      </div>

      {showBreakdownPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="daily-breakdown-title">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <h3 id="daily-breakdown-title" className="text-lg font-semibold">Daily Breakdown</h3>
                <p className="text-sm text-black/60">
                  {selectedBreakdownDate === "all" ? "Showing all available days" : `Showing ${formatDayLabel(selectedBreakdownDate)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakdownPopup(false)}
                className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-black/3"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(88vh-132px)] overflow-auto p-5">
              <table className="min-w-full text-sm">
                <thead className="bg-black/3">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Sales</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Revenue</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDailyBreakdown.length > 0 ? (
                    filteredDailyBreakdown.map((row) => (
                      <tr key={row.date} className="border-t border-black/8 transition-colors hover:bg-black/2">
                        <td className="px-4 py-3">{formatDayLabel(row.date)}</td>
                        <td className="px-4 py-3 font-semibold">{row.salesCount}</td>
                        <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{formatCurrency(row.profit)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-5 text-center text-black/55">No daily breakdown data for this selection.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/10 px-5 py-4">
              <button
                type="button"
                onClick={saveDailyBreakdownSnapshot}
                className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
              >
                Save snapshot
              </button>
              <button
                type="button"
                onClick={downloadDailyBreakdownCsv}
                className="rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
