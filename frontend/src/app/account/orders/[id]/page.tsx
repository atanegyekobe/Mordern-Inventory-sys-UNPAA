"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { ProtectedRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { useToast } from "@/hooks/useToast";
import { getApiErrorMessage, initializeOrderPayment } from "@/lib/payment";
import type { Order } from "@/lib/types";

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

const INTERNAL_NOTE_PATTERNS = [
  "sla",
  "breach",
  "internal",
  "automation",
  "escalation",
  "ops",
  "admin",
];

const formatStatus = (value: string) => {
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

const sanitizeCustomerMessage = (value?: string | null) => {
  if (!value) return null;
  const lowered = value.toLowerCase();
  const hasInternalPattern = INTERNAL_NOTE_PATTERNS.some((pattern) =>
    lowered.includes(pattern)
  );
  return hasInternalPattern ? null : value;
};

const getPaymentModeLabel = (order: Order | null) => {
  const channel = String(order?.metadata?.payment?.channel || "").toLowerCase();
  if (!channel) {
    return order?.status === "pending_payment" ? "Not selected yet" : "Online Payment";
  }

  if (channel.includes("momo") || channel.includes("mobile")) return "Mobile Money";
  if (channel.includes("visa") || channel.includes("master") || channel.includes("card")) return "Card";
  if (channel.includes("bank")) return "Bank Transfer";
  if (channel.includes("ussd")) return "USSD";
  if (channel.includes("qr")) return "QR";
  return "Online Payment";
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

export default function AccountOrderDetailPage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [paying, setPaying] = useState(false);

  const handlePayNow = async () => {
    if (!order) {
      return;
    }

    try {
      setPaying(true);
      const authorizationUrl = await initializeOrderPayment(order.id);
      toast.info("Redirecting to secure checkout...");
      window.location.assign(authorizationUrl);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to initialize payment for this order."));
      setPaying(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!orderId) {
        setStatus("error");
        return;
      }

      try {
        const response = await api.get(`/orders/${orderId}`);
        setOrder(response.data.order ?? null);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    };

    load();
  }, [orderId]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="mb-6">
            <BackButton />
          </div>

          {status === "loading" && (
            <div className="rounded-2xl border border-dashed border-rose-200 bg-white p-6 text-sm text-black/60">
              Loading order details...
            </div>
          )}

          {status === "error" && (
            <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-6 text-sm text-red-700">
              Unable to load this order. It may not exist or you may not have access.
            </div>
          )}

          {status === "ready" && order && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                      Order {order.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{formatDateShort(order.createdAt)}</p>
                    <p className="text-xs text-black/50 mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-black/60">Total</p>
                    <p className="text-2xl font-semibold">{formatCurrency(order.total, order.currency)}</p>
                    <p className="mt-1 text-xs text-black/55">Payment mode: {getPaymentModeLabel(order)}</p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      statusTone[order.status] ?? "border-black/10"
                    }`}
                  >
                    {formatStatus(order.status)}
                  </span>
                </div>

                {order.status === "pending_payment" && (
                  <div className="mt-5 border-t border-black/10 pt-5">
                    <p className="text-sm text-black/60">Payment is still pending for this order.</p>
                    <button
                      type="button"
                      onClick={handlePayNow}
                      disabled={paying}
                      className="mt-3 inline-flex rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {paying ? "Redirecting..." : "Pay Now"}
                    </button>
                  </div>
                )}
              </div>

              {(order.shippingAddress || order.billingAddress) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {order.shippingAddress && (
                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Shipping Address</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">{order.shippingAddress}</p>
                    </div>
                  )}

                  {order.billingAddress && (
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Billing Address</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">{order.billingAddress}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Items</p>
                {order.OrderItems && order.OrderItems.length > 0 ? (
                  <div className="mt-3 divide-y divide-black/5">
                    {order.OrderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                        <div>
                          <p className="font-semibold">{item.Product?.name ?? "Product"}</p>
                          <p className="text-black/60">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(Number(item.unitPrice) * item.quantity, order.currency)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-black/60">No order items found.</p>
                )}
              </div>

              {order.metadata?.fraudReview?.underReview && (
                <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-800">Security Review</p>
                  {order.metadata.fraudReview.signals?.length ? (
                    <div className="mt-2 space-y-1">
                      {order.metadata.fraudReview.signals.map((signal) => (
                        <p key={signal.code} className="text-sm text-fuchsia-900/90">{signal.label}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-fuchsia-900/80">This order is being verified for security checks.</p>
                  )}
                </div>
              )}

              {order.OrderStatusEvents?.some((event) => CUSTOMER_VISIBLE_STATUSES.has(event.toStatus)) && (
                <div className="rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Tracking Timeline</p>
                  <div className="mt-3 space-y-3">
                    {order.OrderStatusEvents.filter((event) => CUSTOMER_VISIBLE_STATUSES.has(event.toStatus)).map((event) => {
                      const safeNote = sanitizeCustomerMessage(event.note);

                      return (
                        <div key={event.id} className="rounded-lg border border-black/10 bg-black/2 p-3">
                          <p className="text-sm font-semibold">{formatStatus(event.toStatus)}</p>
                          {safeNote && <p className="mt-1 text-xs text-black/70">{safeNote}</p>}
                          <p className="mt-1 text-xs text-black/50">{new Date(event.createdAt).toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <Link
                  href="/account/orders"
                  className="inline-flex rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black/70 transition hover:border-black/30 hover:bg-black/5"
                >
                  Back to Orders
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}
