"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { ProtectedRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { useToast } from "@/hooks/useToast";
import { getApiErrorMessage, initializeOrderPayment } from "@/lib/payment";
import type { Order } from "@/lib/types";

function OrderConfirmationContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");
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
      toast.info("Redirecting to Paystack...");
      window.location.assign(authorizationUrl);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to initialize payment for this order."));
      setPaying(false);
    }
  };

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        setStatus("error");
        return;
      }

      try {
        const response = await api.get(`/orders/${orderId}`);
        setOrder(response.data.order);
        setStatus("ready");
      } catch (error) {
        console.error(error);
        setStatus("error");
      }
    };

    loadOrder();
  }, [orderId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-2xl px-6 py-16">
          <p className="text-sm text-black/60">Loading order details...</p>
        </section>
      </div>
    );
  }

  if (status === "error" || !order) {
    return (
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-2xl px-6 py-16">
          <p className="text-sm text-red-600">Order not found.</p>
          <Link
            href="/shop"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            Continue shopping
          </Link>
        </section>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-2xl px-6 py-16">
          <div className="mb-6">
            <BackButton />
          </div>
          <div className="rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-sm">
          {/* Success Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-emerald-100 to-teal-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="mt-6 text-3xl font-semibold">Order Confirmed!</h1>
          <p className="mt-3 text-sm text-black/60">
            Thank you for your order. We&apos;ve received your order and will process it shortly.
          </p>

          {/* Order Details */}
          <div className="mt-8 space-y-4 border-t border-black/10 pt-8">
            <div className="flex justify-between text-sm">
              <span className="text-black/60">Order ID</span>
              <span className="font-mono font-medium">{order.id?.toString().slice(0, 8) ?? orderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-black/60">Order Date</span>
              <span className="font-medium">{formatDateShort(order.createdAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-black/60">Status</span>
              <span className="font-medium capitalize">{order.status}</span>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-4 text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          {order.status === "pending_payment" && (
            <div className="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm font-semibold text-yellow-800">Payment pending</p>
              <p className="mt-1 text-xs text-yellow-900/80">
                Your order was created successfully, but payment is not completed yet.
              </p>
              <button
                type="button"
                onClick={handlePayNow}
                disabled={paying}
                className="mt-3 inline-flex rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? "Redirecting..." : "Complete Payment"}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex gap-3">
            <Link
              href="/account/orders"
              className="flex-1 rounded-full border border-black/15 px-6 py-3 text-center text-sm font-semibold transition hover:border-black/30"
            >
              View Orders
            </Link>
            <Link
              href="/shop"
              className="flex-1 rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-6 py-3 text-center text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600"
            >
              Continue Shopping
            </Link>
          </div>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
          <NavBar />
          <section className="mx-auto w-full max-w-2xl px-6 py-16">
            <p className="text-sm text-black/60">Loading...</p>
          </section>
        </div>
      }
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}
