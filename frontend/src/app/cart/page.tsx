"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import PaginationControls from "@/components/PaginationControls";
import VariantPickerCustomer from "@/components/VariantPickerCustomer";
import { ProtectedRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toAssetUrl } from "@/lib/assets";
import { useToast } from "@/hooks/useToast";
import type { CartSummary, CartItem } from "@/lib/types";
import { useCart } from "@/lib/cart-context";

const PAGE_SIZE = 10;

export default function CartPage() {
  const router = useRouter();
  const { refreshCart: refreshCartCount } = useCart();
  const toast = useToast();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const loadCart = async () => {
      try {
        const response = await api.get("/cart");
        setCart(response.data);
        setStatus("ready");
      } catch (error) {
        console.error(error);
        setStatus("error");
      }
    };

    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const response = await api.get("/cart");
      setCart(response.data);
      await refreshCartCount();
      setStatus("ready");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    try {
      await api.patch(`/cart/items/${itemId}`, { quantity });
      await loadCart();
      toast.success("Quantity updated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update quantity.");
    }
  };

  const handleVariantChange = async (itemId: string, newVariantId: string | null) => {
    try {
      await api.patch(`/cart/items/${itemId}`, { variantId: newVariantId });
      await loadCart();
      toast.success("Variant updated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update variant.");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await api.delete(`/cart/items/${itemId}`);
      await loadCart();
      toast.success("Item removed from cart");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove item.");
    }
  };

  const handleCheckout = () => {
    router.push("/checkout");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <p className="text-sm text-black/60">Loading cart...</p>
        </section>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <p className="text-sm text-red-600">Failed to load cart. Please sign in.</p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium underline">
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  const isEmpty = !cart?.items || cart.items.length === 0;
  const cartItems = cart?.items ?? [];
  const totalItemPages = Math.max(1, Math.ceil(cartItems.length / PAGE_SIZE));
  const safeItemsPage = Math.min(itemsPage, totalItemPages);
  const paginatedItems = cartItems.slice(
    (safeItemsPage - 1) * PAGE_SIZE,
    safeItemsPage * PAGE_SIZE
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-6">
          <BackButton />
        </div>
        <h1 className="text-4xl font-semibold">Your Cart</h1>
        
        {isEmpty ? (
          <div className="mt-10">
            <p className="text-sm text-black/60">Your cart is empty.</p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {paginatedItems.map((item: CartItem) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm"
                  >
                    <div className="flex gap-4">
                      {item.Product?.imageUrl ? (
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          <Image
                            src={toAssetUrl(item.Product.imageUrl)}
                            alt={item.Product?.name ?? "Removed product"}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-24 w-24 shrink-0 rounded-lg bg-linear-to-br from-blue-50 to-purple-50" />
                      )}
                      <div className="flex flex-1 flex-col gap-2">
                        <h3 className="font-semibold">{item.Product?.name ?? "Product no longer available"}</h3>
                        <p className="text-sm text-black/60">
                          {item.Product?.Category?.name ?? "Product"}
                        </p>
                        
                        {/* Show selected variant details */}
                        {item.ProductVariant && (
                          <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50/70 p-2 text-sm text-black/60">
                            <p>
                              <span className="font-semibold">Selected:</span>{" "}
                              {Object.entries(item.ProductVariant.attributes || {})
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(", ")}
                            </p>
                          </div>
                        )}
                        
                        <p className="text-sm font-semibold">
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                        <div className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="text-lg font-semibold disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            className="text-lg font-semibold"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-sm font-semibold">
                          {formatCurrency(Number(item.unitPrice) * item.quantity)}
                        </p>
                      </div>
                    </div>

                    {/* Variant Picker for items with variants */}
                    {item.Product?.ProductVariants && item.Product.ProductVariants.length > 0 && (
                      <div className="mt-4 border-t border-black/10 pt-4">
                        <p className="text-xs font-semibold text-black/60 mb-3">CHANGE OPTIONS</p>
                        <VariantPickerCustomer
                          product={item.Product}
                          onVariantSelect={(variant) => {
                            if (!variant) return;
                            if (variant.id === item.VariantId) return;
                            handleVariantChange(item.id, variant.id);
                          }}
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <PaginationControls
                totalItems={cartItems.length}
                currentPage={safeItemsPage}
                pageSize={PAGE_SIZE}
                onPageChange={setItemsPage}
                itemLabel="cart items"
                className="mt-4"
              />
            </div>

            {/* Cart Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-black/10 bg-white p-6">
                <h2 className="text-xl font-semibold">Summary</h2>
                <div className="mt-6 space-y-3 border-t border-black/10 pt-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Items</span>
                    <span className="font-medium">{cart.totals.items}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-black/60">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(cart.totals.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-black/10 pt-3 text-lg font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(cart.totals.subtotal)}</span>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  className="mt-6 w-full rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600"
                >
                  Proceed to checkout
                </button>
                <Link
                  href="/shop"
                  className="mt-3 block text-center text-sm font-medium text-black/60 hover:underline"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
    </ProtectedRoute>
  );
}
