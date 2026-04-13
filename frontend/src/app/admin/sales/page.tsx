"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type SalesResponse = {
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    ordersCount: number;
    lineItemsCount: number;
    unitsSold: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
  };
  orderProfitability: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    items: {
      id: string;
      createdAt: string;
      quantity: number;
      unitPrice: number;
      revenue: number;
      costTotal: number;
      profit: number;
      marginPct: number;
      order: {
        id: string;
        status: string;
        currency: string;
        total: number;
        createdAt: string;
      };
      product: {
        id: string;
        name: string;
        stock: number;
        cost: number;
        categoryName: string;
      };
    }[];
  };
  stockBreakdown: {
    productId: string;
    productName: string;
    categoryName: string;
    stockRemaining: number;
    ordersCount: number;
    unitsSold: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
  }[];
  filters: {
    options: {
      categories: { id: string; name: string }[];
      products: { id: string; name: string; CategoryId: string; stock: number }[];
    };
  };
  generatedAt: string;
};

const PAGE_SIZE = 25;

type SalesTab = "overview" | "history";
type MarginBand = "all" | "loss" | "low" | "medium" | "high";
type StockBand = "all" | "critical" | "low" | "healthy";
type HistorySort = "newest" | "oldest" | "profitDesc" | "profitAsc" | "marginDesc" | "revenueDesc";

export default function SalesManagementPage() {
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [activeTab, setActiveTab] = useState<SalesTab>("overview");

  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [marginBand, setMarginBand] = useState<MarginBand>("all");
  const [stockBand, setStockBand] = useState<StockBand>("all");
  const [historySort, setHistorySort] = useState<HistorySort>("newest");

  const [page, setPage] = useState(1);

  const fetchData = async () => {
    try {
      if (period === "custom" && (!customStartDate || !customEndDate)) {
        return;
      }

      setLoading(true);
      setError(null);

      const query = new URLSearchParams({
        period,
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (period === "custom") {
        query.set("startDate", customStartDate);
        query.set("endDate", customEndDate);
      }
      if (categoryId) query.set("categoryId", categoryId);
      if (productId) query.set("productId", productId);
      if (orderId.trim()) query.set("orderId", orderId.trim());

      const response = await api.get(`/admin/sales-management?${query.toString()}`);
      setData(response.data);
    } catch {
      setError("Failed to load sales management data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStartDate, customEndDate, categoryId, productId, orderId, page]);

  const filteredProductOptions = useMemo(() => {
    const products = data?.filters?.options?.products ?? [];
    if (!categoryId) return products;
    return products.filter((product) => product.CategoryId === categoryId);
  }, [data?.filters?.options?.products, categoryId]);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const metricValueClass = "mt-2 break-words text-lg font-semibold leading-tight sm:text-xl";
  const moneyCellClass = "px-3 py-2 text-right text-xs tabular-nums sm:text-sm";

  const historyStatuses = useMemo(() => {
    const statuses = new Set<string>();
    for (const row of data?.orderProfitability.items ?? []) {
      statuses.add(row.order.status || "unknown");
    }
    return Array.from(statuses).sort((a, b) => a.localeCompare(b));
  }, [data?.orderProfitability.items]);

  const historyRows = useMemo(() => {
    const rows = [...(data?.orderProfitability.items ?? [])];

    const matchesMarginBand = (marginPct: number) => {
      if (marginBand === "all") return true;
      if (marginBand === "loss") return marginPct < 0;
      if (marginBand === "low") return marginPct >= 0 && marginPct < 20;
      if (marginBand === "medium") return marginPct >= 20 && marginPct < 40;
      return marginPct >= 40;
    };

    const matchesStockBand = (stock: number) => {
      if (stockBand === "all") return true;
      if (stockBand === "critical") return stock <= 5;
      if (stockBand === "low") return stock > 5 && stock <= 20;
      return stock > 20;
    };

    const query = historyQuery.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const statusMatch = historyStatus === "all" || item.order.status === historyStatus;
      const marginMatch = matchesMarginBand(item.marginPct);
      const stockMatch = matchesStockBand(item.product.stock);

      if (!statusMatch || !marginMatch || !stockMatch) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${item.order.id} ${item.product.name} ${item.product.categoryName}`.toLowerCase();
      return haystack.includes(query);
    });

    filtered.sort((a, b) => {
      if (historySort === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (historySort === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (historySort === "profitDesc") {
        return b.profit - a.profit;
      }
      if (historySort === "profitAsc") {
        return a.profit - b.profit;
      }
      if (historySort === "marginDesc") {
        return b.marginPct - a.marginPct;
      }
      return b.revenue - a.revenue;
    });

    return filtered;
  }, [data?.orderProfitability.items, historyStatus, marginBand, stockBand, historyQuery, historySort]);

  const historyInsights = useMemo(() => {
    const rows = historyRows;
    const lossRows = rows.filter((row) => row.profit < 0);
    const lowStockRows = rows.filter((row) => row.product.stock <= 5);
    const bestProfitRow = rows.reduce<typeof rows[number] | null>((best, row) => {
      if (!best) return row;
      return row.profit > best.profit ? row : best;
    }, null);

    const avgMargin = rows.length > 0 ? rows.reduce((sum, row) => sum + row.marginPct, 0) / rows.length : 0;
    const totalShownProfit = rows.reduce((sum, row) => sum + row.profit, 0);
    const totalLossImpact = lossRows.reduce((sum, row) => sum + row.profit, 0);

    return {
      avgMargin,
      totalShownProfit,
      lossesCount: lossRows.length,
      totalLossImpact,
      lowStockCount: lowStockRows.length,
      bestProfitRow,
    };
  }, [historyRows]);

  const getSignal = (item: SalesResponse["orderProfitability"]["items"][number]) => {
    if (item.profit < 0) {
      return { label: "Loss Alert", tone: "text-red-700 bg-red-50 border-red-200" };
    }
    if (item.marginPct >= 40) {
      return { label: "High Margin", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }
    if (item.product.stock <= 5 && item.quantity >= 2) {
      return { label: "Restock Trigger", tone: "text-amber-700 bg-amber-50 border-amber-200" };
    }
    if (item.quantity >= 5) {
      return { label: "Volume Driver", tone: "text-sky-700 bg-sky-50 border-sky-200" };
    }
    return { label: "Stable", tone: "text-black/70 bg-black/3 border-black/10" };
  };

  const exportOrderRowsCsv = () => {
    if (!data?.orderProfitability.items?.length) return;

    const header = [
      "Order ID",
      "Order Date",
      "Status",
      "Product",
      "Category",
      "Qty",
      "Unit Price",
      "Revenue",
      "Cost",
      "Profit",
      "Margin %",
      "Stock Remaining",
    ];

    const rows = data.orderProfitability.items.map((item) => [
      item.order.id,
      new Date(item.order.createdAt).toISOString(),
      item.order.status,
      item.product.name,
      item.product.categoryName,
      String(item.quantity),
      String(item.unitPrice),
      String(item.revenue),
      String(item.costTotal),
      String(item.profit),
      String(item.marginPct),
      String(item.product.stock),
    ]);

    const csv = [header, ...rows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-movement-profitability-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell title="Stock Movements">
      <div className="space-y-6">
        <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-900">Movement Notes</h2>
          <p className="mt-2 text-sm text-sky-900/90">
            Track stock inflow and outflow using product-level profitability and unit movement.
          </p>
          <p className="mt-1 text-sm text-sky-900/90">
            Tip: start with critical and low stock items, then verify margin trends by category.
          </p>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                <option value="day">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {period === "custom" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setProductId("");
                  setPage(1);
                }}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Categories</option>
                {(data?.filters?.options?.categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Products</option>
                {filteredProductOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                Specific Order ID
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setPage(1);
                }}
                placeholder="Paste full order UUID"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {loading && <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black/60">Loading stock movement data...</div>}

        {!loading && data && (
          <>
            <section className="rounded-2xl border border-black/10 bg-white p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    activeTab === "overview"
                      ? "bg-black text-white"
                      : "border border-black/10 bg-white text-black hover:bg-black/5"
                  }`}
                >
                  Performance Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    activeTab === "history"
                      ? "bg-black text-white"
                      : "border border-black/10 bg-white text-black hover:bg-black/5"
                  }`}
                >
                  Movement History & Smart Analysis
                </button>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-black/55">Orders</p>
                <p className="mt-2 text-2xl font-semibold">{data.summary.ordersCount}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-black/55">Units Sold</p>
                <p className="mt-2 text-2xl font-semibold">{data.summary.unitsSold}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-black/55">Revenue</p>
                <p className={`${metricValueClass} text-sky-700`}>{formatCurrency(data.summary.revenue)}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-black/55">Cost</p>
                <p className={`${metricValueClass} text-amber-700`}>{formatCurrency(data.summary.cost)}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-black/55">Profit</p>
                <p className={`${metricValueClass} text-emerald-700`}>{formatCurrency(data.summary.profit)}</p>
                <p className="mt-1 text-xs text-black/55">Margin {formatPercent(data.summary.marginPct)}</p>
              </div>
            </section>

            {activeTab === "overview" && (
              <section className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold">Stock Profit Summary</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-black/3">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-semibold">Product</th>
                        <th className="px-3 py-2 font-semibold">Stock Left</th>
                        <th className="px-3 py-2 font-semibold">Orders</th>
                        <th className="px-3 py-2 font-semibold">Units Sold</th>
                        <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                        <th className="px-3 py-2 text-right font-semibold">Cost</th>
                        <th className="px-3 py-2 text-right font-semibold">Profit</th>
                        <th className="px-3 py-2 font-semibold">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stockBreakdown.length > 0 ? (
                        data.stockBreakdown.map((stock, index) => (
                          <tr key={`${stock.productId}-${stock.categoryName}-${index}`} className="border-t border-black/8 hover:bg-black/2">
                            <td className="px-3 py-2">
                              <p className="font-medium">{stock.productName}</p>
                              <p className="text-xs text-black/55">{stock.categoryName}</p>
                            </td>
                            <td className="px-3 py-2">{stock.stockRemaining}</td>
                            <td className="px-3 py-2">{stock.ordersCount}</td>
                            <td className="px-3 py-2">{stock.unitsSold}</td>
                            <td className={moneyCellClass}>{formatCurrency(stock.revenue)}</td>
                            <td className={moneyCellClass}>{formatCurrency(stock.cost)}</td>
                            <td className={`${moneyCellClass} font-semibold text-emerald-700`}>{formatCurrency(stock.profit)}</td>
                            <td className="px-3 py-2">{formatPercent(stock.marginPct)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-black/55">No stock summary available for this selection.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "history" && (
              <>
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-black/55">Filtered Profit</p>
                    <p className={`${metricValueClass} text-emerald-700`}>{formatCurrency(historyInsights.totalShownProfit)}</p>
                    <p className="mt-1 text-xs text-black/55">From {historyRows.length} visible rows</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-black/55">Average Margin</p>
                    <p className="mt-2 text-2xl font-semibold">{formatPercent(historyInsights.avgMargin)}</p>
                    <p className="mt-1 text-xs text-black/55">Smart quality indicator</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-black/55">Loss Alerts</p>
                    <p className="mt-2 text-2xl font-semibold text-red-700">{historyInsights.lossesCount}</p>
                    <p className="mt-1 break-words text-xs text-black/55">Impact {formatCurrency(historyInsights.totalLossImpact)}</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-black/55">Low Stock Signals</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-700">{historyInsights.lowStockCount}</p>
                    <p className="mt-1 break-words text-xs text-black/55">
                      Best line {historyInsights.bestProfitRow ? formatCurrency(historyInsights.bestProfitRow.profit) : formatCurrency(0)}
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">Movement History Table</h2>
                    <button
                      type="button"
                      onClick={exportOrderRowsCsv}
                      className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/3"
                    >
                      Export CSV
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <input
                      type="text"
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      placeholder="Search order, product, category"
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                    <select
                      value={historyStatus}
                      onChange={(e) => setHistoryStatus(e.target.value)}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    >
                      <option value="all">All statuses</option>
                      {historyStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <select
                      value={marginBand}
                      onChange={(e) => setMarginBand(e.target.value as MarginBand)}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    >
                      <option value="all">All margins</option>
                      <option value="loss">Loss lines</option>
                      <option value="low">Low margin (0-19%)</option>
                      <option value="medium">Medium margin (20-39%)</option>
                      <option value="high">High margin (40%+)</option>
                    </select>
                    <select
                      value={stockBand}
                      onChange={(e) => setStockBand(e.target.value as StockBand)}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    >
                      <option value="all">All stock levels</option>
                      <option value="critical">Critical stock (&lt;=5)</option>
                      <option value="low">Low stock (6-20)</option>
                      <option value="healthy">Healthy stock (21+)</option>
                    </select>
                    <select
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value as HistorySort)}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="profitDesc">Highest profit</option>
                      <option value="profitAsc">Lowest profit</option>
                      <option value="marginDesc">Highest margin</option>
                      <option value="revenueDesc">Highest revenue</option>
                    </select>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-xl border border-black/10">
                    <table className="min-w-full text-sm">
                      <thead className="bg-black text-white">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-semibold">Order</th>
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Product</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 font-semibold">Qty</th>
                          <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                          <th className="px-3 py-2 text-right font-semibold">Cost</th>
                          <th className="px-3 py-2 text-right font-semibold">Profit</th>
                          <th className="px-3 py-2 font-semibold">Margin</th>
                          <th className="px-3 py-2 font-semibold">Stock</th>
                          <th className="px-3 py-2 font-semibold">Smart Signal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.length > 0 ? (
                          historyRows.map((item, index) => {
                            const signal = getSignal(item);
                            return (
                              <tr
                                key={`${item.id || "row"}-${item.order.id}-${item.product.id}-${item.createdAt}-${index}`}
                                className="border-t border-black/8 hover:bg-black/2"
                              >
                                <td className="px-3 py-2 text-xs font-semibold">{item.order.id.slice(0, 8)}</td>
                                <td className="px-3 py-2 text-xs">{new Date(item.createdAt).toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <p className="font-medium">{item.product.name}</p>
                                  <p className="text-xs text-black/55">{item.product.categoryName}</p>
                                </td>
                                <td className="px-3 py-2 text-xs uppercase tracking-[0.08em]">{item.order.status}</td>
                                <td className="px-3 py-2">{item.quantity}</td>
                                <td className={moneyCellClass}>{formatCurrency(item.revenue, item.order.currency)}</td>
                                <td className={moneyCellClass}>{formatCurrency(item.costTotal, item.order.currency)}</td>
                                <td className={`${moneyCellClass} font-semibold ${item.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                  {formatCurrency(item.profit, item.order.currency)}
                                </td>
                                <td className="px-3 py-2">{formatPercent(item.marginPct)}</td>
                                <td className="px-3 py-2">{item.product.stock}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${signal.tone}`}>
                                    {signal.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={11} className="px-3 py-6 text-center text-black/55">No history rows match the current smart filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <PaginationControls
                    totalItems={data.orderProfitability.totalItems}
                    currentPage={data.orderProfitability.page}
                    pageSize={data.orderProfitability.limit}
                    onPageChange={setPage}
                    itemLabel="rows"
                    className="mt-4"
                  />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
