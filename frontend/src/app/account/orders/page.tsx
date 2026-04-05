"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { ProtectedRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { useNotifications } from "@/lib/notification-alert-context";
import { useToast } from "@/hooks/useToast";
import { getApiErrorMessage, initializeOrderPayment } from "@/lib/payment";
import type { Order, OrderNotification } from "@/lib/types";

const ORDERS_PER_PAGE = 10;

const CUSTOMER_VISIBLE_STATUSES = new Set([
  "pending_payment",
  "pending",
  "paid",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivery_pickup",
  "delivered",
  "received",
  "delivery_failed",
  "cancelled",
  "returned",
  "refunded",
  "fraud_hold",
  "fulfilled",
]);

const toCustomerStatusLabel = (value: string) => {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized === "fraud_hold") return "Under Review";
  if (normalized === "packed") return "Preparing Shipment";
  if (normalized === "delivery_pickup") return "Ready for Pickup";
  if (normalized === "fulfilled") return "Delivered";

  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatStatus = (value: string) => toCustomerStatusLabel(value);

const INTERNAL_NOTE_PATTERNS = [
  "sla",
  "breach",
  "internal",
  "automation",
  "escalation",
  "ops",
  "admin",
];

const isInternalCustomerMessage = (value?: string | null) => {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return INTERNAL_NOTE_PATTERNS.some((pattern) => lowered.includes(pattern));
};

const sanitizeCustomerMessage = (value?: string | null) => {
  if (!value) return null;
  return isInternalCustomerMessage(value) ? null : value;
};

const statusTone: Record<string, string> = {
  pending_payment: "border-yellow-200 bg-yellow-50 text-yellow-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  packed: "border-indigo-200 bg-indigo-50 text-indigo-800",
  shipped: "border-sky-200 bg-sky-50 text-sky-800",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-800",
  delivered: "border-teal-200 bg-teal-50 text-teal-800",
  received: "border-zinc-200 bg-zinc-100 text-zinc-800",
  delivery_failed: "border-rose-200 bg-rose-50 text-rose-800",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  returned: "border-orange-200 bg-orange-50 text-orange-800",
  refunded: "border-emerald-200 bg-emerald-50 text-emerald-800",
  fraud_hold: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  pending: "border-yellow-200 bg-yellow-50 text-yellow-800",
  delivery_pickup: "border-violet-200 bg-violet-50 text-violet-800",
  fulfilled: "border-zinc-200 bg-zinc-100 text-zinc-800",
};

export default function OrdersPage() {
  const toast = useToast();
  const { markAllOrderNotificationsAsRead } = useNotifications();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderNotifications, setOrderNotifications] = useState<OrderNotification[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const handlePayNow = async (orderId: string) => {
    try {
      setPayingOrderId(orderId);
      const authorizationUrl = await initializeOrderPayment(orderId);
      toast.info("Redirecting to secure checkout...");
      window.location.assign(authorizationUrl);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to initialize payment for this order."));
      setPayingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      const matchesSearch =
        !normalizedSearch ||
        order.id.toLowerCase().includes(normalizedSearch) ||
        formatStatus(order.status).toLowerCase().includes(normalizedSearch);
      const matchesFrom = !fromDate || createdAt >= fromDate;
      const matchesTo = !toDate || createdAt <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [orders, searchTerm, dateFrom, dateTo]);

  const customerNotifications = useMemo(() => {
    return orderNotifications.filter((notification) => {
      const subjectVisible = !isInternalCustomerMessage(notification.subject);
      const contentVisible = !isInternalCustomerMessage(notification.content);
      return subjectVisible && contentVisible;
    });
  }, [orderNotifications]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * ORDERS_PER_PAGE;
  const pageEnd = pageStart + ORDERS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(pageStart, pageEnd);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const [orderResponse, notificationResponse] = await Promise.all([
          api.get("/orders"),
          api.get("/order-notifications"),
        ]);
        if (isActive) {
          const notifications = notificationResponse.data ?? [];
          setOrders(orderResponse.data.orders ?? []);
          setCurrentPage(1);
          setOrderNotifications(notifications);
          setStatus("ready");
          if (notifications.some((note: OrderNotification) => !note.readAt)) {
            await markAllOrderNotificationsAsRead();
          }
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
  }, [markAllOrderNotificationsAsRead]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="rounded-3xl border border-rose-100 bg-white/90 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-black/90">Your orders</h1>
        <p className="mt-2 text-sm text-black/65">
          Track the latest shipments and manage returns.
        </p>
        </div>
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Search Order
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Order ID or status"
                className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black/80 outline-none transition focus:border-black/40"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              From Date
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setCurrentPage(1);
                }}
                className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black/80 outline-none transition focus:border-black/40"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              To Date
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setCurrentPage(1);
                }}
                className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black/80 outline-none transition focus:border-black/40"
              />
            </label>
          </div>
        </div>
        {customerNotifications.length > 0 && (
          <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5">
            <h2 className="text-lg font-semibold">Order updates</h2>
            <p className="mt-1 text-sm text-black/60">
              Latest status notifications for your orders.
            </p>
            <div className="mt-4 divide-y divide-black/5">
              {customerNotifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {sanitizeCustomerMessage(notification.subject)}
                      </p>
                      <p className="mt-1 text-xs text-black/60">
                        {sanitizeCustomerMessage(notification.content)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-black/50">
                      {formatDateShort(notification.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 grid gap-4">
          {filteredOrders.length > 0 ? (
            paginatedOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      statusTone[order.status] ?? "border-black/10"
                    }`}
                  >
                    {formatStatus(order.status)}
                  </span>
                </div>

                {order.OrderStatusEvents && order.OrderStatusEvents.length > 0 && (
                  <div className="rounded-lg border border-black/10 bg-white p-3">
                    <p className="text-xs font-semibold text-black/60">Tracking timeline</p>
                    <div className="mt-2 space-y-2">
                      {order.OrderStatusEvents.filter((event) => CUSTOMER_VISIBLE_STATUSES.has(event.toStatus))
                        .slice(0, 3)
                        .map((event) => {
                          const safeNote = sanitizeCustomerMessage(event.note);

                          return (
                            <div key={event.id} className="text-xs text-black/70">
                              <p className="font-medium">{formatStatus(event.toStatus)}</p>
                              {safeNote && <p className="mt-0.5 text-black/60">{safeNote}</p>}
                              <p className="text-black/50">{new Date(event.createdAt).toLocaleString()}</p>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {order.metadata?.fraudReview?.underReview && (
                  <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-800">
                      Security Review
                    </p>
                    {order.metadata?.fraudReview?.signals?.length ? (
                      <div className="mt-2 space-y-1">
                        {order.metadata.fraudReview.signals.map((signal) => (
                          <p key={signal.code} className="text-xs text-fuchsia-900/90">
                            {signal.label}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-fuchsia-900/80">
                        This order is being verified for security checks.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {order.status === "pending_payment" && (
                    <button
                      type="button"
                      onClick={() => handlePayNow(order.id)}
                      disabled={payingOrderId === order.id}
                      className="inline-flex rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-3 py-1 text-xs font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {payingOrderId === order.id ? "Redirecting..." : "Pay Now"}
                    </button>
                  )}
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="inline-flex rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/30"
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
            ))
          ) : (
              <div className="rounded-2xl border border-dashed border-rose-200 bg-white p-6 text-sm text-black/60">
              {status === "error" && "Sign in to view your orders."}
              {status === "loading" && "Loading orders..."}
              {status === "ready" && orders.length === 0 && "You do not have any orders yet."}
              {status === "ready" && orders.length > 0 && "No orders match your search/date filters."}
            </div>
          )}

          {filteredOrders.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white/90 p-4 text-sm text-black/70 shadow-sm md:flex-row md:items-center md:justify-between">
              <p>
                Showing {pageStart + 1}-{Math.min(pageEnd, filteredOrders.length)} of {filteredOrders.length} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={activePage === 1}
                  className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-black/60">
                  Page {activePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={activePage >= totalPages}
                  className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
    </ProtectedRoute>
  );
}
