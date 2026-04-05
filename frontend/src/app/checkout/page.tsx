"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import PaginationControls from "@/components/PaginationControls";
import { ProtectedRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/useToast";
import type { CartSummary } from "@/lib/types";

const PAGE_SIZE = 10;

export default function CheckoutPage() {
  const router = useRouter();
  const toast = useToast();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "processing" | "redirecting">("idle");
  const [shippingAddress, setShippingAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discount: number;
    finalAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const response = await api.get("/cart");
        setCart(response.data);
        setStatus("idle");
      } catch (error) {
        console.error(error);
        toast.error("Failed to load cart. Please sign in.");
        router.push("/login");
      }
    };

    loadCart();
  }, [router, toast]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.warning("Please enter a coupon code");
      return;
    }

    if (!cart) return;

    try {
      setValidatingCoupon(true);
      setCouponError("");
      const response = await api.post("/coupons/validate", {
        code: couponCode.toUpperCase(),
        orderAmount: cart.totals.subtotal,
      });

      setAppliedCoupon({
        id: response.data.coupon.id,
        code: response.data.coupon.code,
        discount: Number(response.data.discount),
        finalAmount: Number(response.data.finalAmount),
      });
      setCouponError("");
      toast.success("Coupon applied!");
    } catch (error: unknown) {
      const errorMsg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error ===
          "string"
          ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error as string)
          : "Invalid coupon code";
      setCouponError(errorMsg);
      toast.error(errorMsg);
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shippingAddress.trim()) {
      toast.warning("Please enter a shipping address.");
      return;
    }

    const finalBillingAddress = sameAsShipping ? shippingAddress : billingAddress;

    setStatus("processing");
    let createdOrderId: string | null = null;

    try {
      const response = await api.post("/cart/checkout", {
        shippingAddress: shippingAddress.trim(),
        billingAddress: finalBillingAddress.trim(),
        couponId: appliedCoupon?.id || null,
      });

      const orderId = response.data.order.id;
      createdOrderId = orderId;

      setStatus("redirecting");
      const paymentInit = await api.post("/payments/initialize", {
        orderId,
      });

      const authorizationUrl: string | undefined = paymentInit.data.authorizationUrl;
      if (!authorizationUrl) {
        throw new Error("No payment authorization URL returned.");
      }

      toast.info("Redirecting to secure payment...");
      window.location.assign(authorizationUrl);
    } catch (error) {
      console.error(error);
      toast.error("Unable to start payment. Your order is saved as pending payment.");
      if (createdOrderId) {
        router.push(`/order-confirmation?id=${createdOrderId}`);
        return;
      }
      setStatus("idle");
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <p className="text-sm text-black/60">Your cart is empty.</p>
          <Link
            href="/shop"
            className="mt-4 inline-block rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600"
          >
            Start shopping
          </Link>
        </section>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(cart.items.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = cart.items.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-6">
          <BackButton />
        </div>
        <h1 className="text-4xl font-semibold">Checkout</h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {/* Checkout Form */}
          <form onSubmit={handleCheckout} className="lg:col-span-2">
            <div className="space-y-8">
              {/* Shipping Address */}
              <div>
                <h2 className="text-xl font-semibold">Shipping Address</h2>
                <textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter your full shipping address"
                  rows={4}
                  className="mt-4 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm outline-none focus:border-rose-300"
                  required
                />
              </div>

              {/* Billing Address */}
              <div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="sameAsShipping"
                    checked={sameAsShipping}
                    onChange={(e) => setSameAsShipping(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="sameAsShipping" className="text-sm font-medium">
                    Billing address same as shipping
                  </label>
                </div>

                {!sameAsShipping && (
                  <>
                    <h2 className="mt-6 text-xl font-semibold">Billing Address</h2>
                    <textarea
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      placeholder="Enter your billing address"
                      rows={4}
                      className="mt-4 w-full rounded-xl border border-rose-100 bg-white px-4 py-3 text-sm outline-none focus:border-rose-300"
                      required={!sameAsShipping}
                    />
                  </>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status === "processing" || status === "redirecting"}
                className="w-full rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:opacity-50"
              >
                {status === "processing"
                  ? "Creating Order..."
                  : status === "redirecting"
                    ? "Redirecting to Payment..."
                    : "Place Order & Pay"}
              </button>
            </div>
          </form>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Order Summary</h2>
              
              {/* Items List */}
              <div className="mt-6 space-y-3 border-t border-black/10 pt-6">
                {paginatedItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-black/60">
                      {item.Product?.name ?? "Removed product"} × {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(Number(item.unitPrice) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <PaginationControls
                totalItems={cart.items.length}
                currentPage={safePage}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemLabel="items"
                className="mt-4"
              />

              {/* Totals */}
              <div className="mt-6 space-y-3 border-t border-black/10 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-black/60">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(cart.totals.subtotal)}
                  </span>
                </div>

                {/* Coupon Section */}
                <div className="space-y-2">
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Coupon code"
                        className="flex-1 rounded-lg border border-rose-100 px-3 py-2 text-sm outline-none focus:border-rose-300"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon}
                        className="rounded-lg bg-linear-to-r from-rose-500 to-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:from-rose-600 hover:to-orange-600 disabled:opacity-50"
                      >
                        {validatingCoupon ? "..." : "Apply"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-green-800">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-sm text-green-600">
                          -{formatCurrency(appliedCoupon.discount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-xs text-red-600">{couponError}</p>
                  )}
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span className="font-medium">
                      -{formatCurrency(appliedCoupon.discount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-black/60">Shipping</span>
                  <span className="font-medium">Free</span>
                </div>
                <div className="flex justify-between border-t border-black/10 pt-3 text-lg font-semibold">
                  <span>Total</span>
                  <span>
                    {formatCurrency(
                      appliedCoupon?.finalAmount || cart.totals.subtotal
                    )}
                  </span>
                </div>
              </div>

              <Link
                href="/cart"
                className="mt-6 block text-center text-sm font-medium text-black/60 hover:underline"
              >
                Back to cart
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
    </ProtectedRoute>
  );
}
