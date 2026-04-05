"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import { ProtectedRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { useToast } from "@/hooks/useToast";

type VerifyState = "verifying" | "error";

function CheckoutVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [state, setState] = useState<VerifyState>("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get("reference") || searchParams.get("trxref");
      if (!reference) {
        setState("error");
        setErrorMessage("Missing payment reference in callback URL.");
        return;
      }

      try {
        const response = await api.get(`/payments/verify/${encodeURIComponent(reference)}`);
        const payload = response.data;

        if (payload.verified) {
          toast.success("Payment successful. Order updated.");
          router.replace(`/order-confirmation?id=${payload.orderId}`);
          return;
        }

        toast.warning("Payment was not completed. You can retry from your orders page.");
        router.replace(`/account/orders/${payload.orderId}`);
      } catch (error: unknown) {
        console.error(error);
        setState("error");
        const errorMessage =
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as { response?: { data?: { message?: unknown } } }).response?.data
            ?.message === "string"
            ? ((error as { response?: { data?: { message?: string } } }).response?.data
                ?.message as string)
            : "Failed to verify payment.";
        setErrorMessage(errorMessage);
        toast.error("Payment verification failed.");
      }
    };

    verifyPayment();
  }, [router, searchParams, toast]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <NavBar />
        <section className="mx-auto w-full max-w-2xl px-6 py-16">
          {state === "verifying" ? (
            <div className="rounded-2xl border border-black/10 bg-white p-8">
              <h1 className="text-2xl font-semibold">Verifying Payment...</h1>
              <p className="mt-3 text-sm text-black/60">
                Please wait while we confirm your transaction and update your order.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
              <h1 className="text-2xl font-semibold text-red-700">Verification Failed</h1>
              <p className="mt-3 text-sm text-red-700/90">{errorMessage}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/account/orders"
                  className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-700"
                >
                  Go to My Orders
                </Link>
                <Link
                  href="/checkout"
                  className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white"
                >
                  Back to Checkout
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}

export default function CheckoutVerifyPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <div className="min-h-screen">
            <NavBar />
            <section className="mx-auto w-full max-w-2xl px-6 py-16">
              <div className="rounded-2xl border border-black/10 bg-white p-8">
                <h1 className="text-2xl font-semibold">Verifying Payment...</h1>
                <p className="mt-3 text-sm text-black/60">
                  Please wait while we confirm your transaction and update your order.
                </p>
              </div>
            </section>
          </div>
        </ProtectedRoute>
      }
    >
      <CheckoutVerifyContent />
    </Suspense>
  );
}
