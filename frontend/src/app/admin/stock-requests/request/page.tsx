"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { AdminRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/useToast";
import BackButton from "@/components/BackButton";

type Product = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  status?: string;
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || "Something went wrong.";
  }
  return "Something went wrong.";
};

export default function RequestStockPage() {
  const toast = useToast();
  const router = useRouter();
  const { user, shops, activeShopId, isLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const activeShop = activeShopId
    ? shops.find((shop) => shop.id === activeShopId) || null
    : shops.length === 1
    ? shops[0]
    : null;
  const isStaff = Boolean(user?.role !== "admin" && activeShop?.role === "STAFF");

  useEffect(() => {
    if (!isLoading && !isStaff) {
      router.replace("/admin/stock-requests");
    }
  }, [isLoading, isStaff, router]);

  useEffect(() => {
    if (!isStaff) {
      setLoading(false);
      return;
    }

    const loadProducts = async () => {
      try {
        setLoading(true);
        const response = await api.get("/products");
        setProducts(
          (response.data.products as Product[] | undefined)?.filter((product) => product.status === "active") ?? []
        );
      } catch (error) {
        toast.error(getErrorMessage(error));
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, [isStaff, toast]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  if (!isLoading && !isStaff) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !quantity) {
      toast.warning("Please select a product and enter a quantity.");
      return;
    }

    if (Number(quantity) < 1) {
      toast.warning("Quantity must be at least 1.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/stock-requests", {
        productId: selectedProductId,
        quantity: Number(quantity),
        reason: reason.trim() || null,
      });

      toast.success("Stock request submitted successfully!");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push("/admin/stock-requests");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminRoute>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,transparent_26%),radial-gradient(circle_at_top_right,#cffafe_0%,transparent_24%),linear-gradient(180deg,#fafaf9_0%,#f8fafc_100%)]">
        <NavBar />
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div>
              <BackButton label="View all requests" to="/admin/stock-requests" className="mb-4" />
              <h1 className="text-3xl font-bold text-black">Request Stock</h1>
              <p className="mt-2 text-sm text-black/60">
                Submit a request to add stock to a product. An admin or owner will review and approve or reject your request.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product Selection */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <label className="block text-sm font-semibold uppercase tracking-widest text-black/45">
                  Select Product
                </label>
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-black/10 bg-black/2 px-4 py-3 text-sm outline-none transition placeholder:text-black/35 focus:border-black/30 focus:bg-white"
                />

                {loading ? (
                  <div className="mt-3 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-12 rounded-lg border border-black/10 bg-black/2 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <label
                        key={product.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition ${
                          selectedProductId === product.id
                            ? "border-sky-500 bg-sky-50"
                            : "border-black/10 bg-white hover:border-black/20"
                        }`}
                      >
                        <input
                          type="radio"
                          name="product"
                          value={product.id}
                          checked={selectedProductId === product.id}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="h-4 w-4 rounded-full border-2 border-black/20 accent-sky-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-black">{product.name}</p>
                          <p className="text-xs text-black/55">
                            SKU: {product.sku} • Stock: {product.stock}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity Input */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <label className="block text-sm font-semibold uppercase tracking-widest text-black/45">
                  Quantity Requested
                </label>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity..."
                    className="w-full rounded-lg border border-black/10 bg-black/2 px-4 py-3 text-sm outline-none transition placeholder:text-black/35 focus:border-black/30 focus:bg-white"
                  />
                  <span className="whitespace-nowrap text-sm font-semibold text-black/60">units</span>
                </div>
                {selectedProduct && (
                  <div className="mt-3 rounded-lg bg-black/2 p-3">
                    <p className="text-xs uppercase tracking-widest text-black/45">
                      Current Stock: {selectedProduct.stock}
                    </p>
                    {quantity && (
                      <p className="mt-1 text-sm font-semibold text-black">
                        New total: {selectedProduct.stock + Number(quantity)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Reason (Optional) */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <label className="block text-sm font-semibold uppercase tracking-widest text-black/45">
                  Reason (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you need this stock (e.g., customer demand, seasonal peak, etc.)..."
                  className="mt-3 w-full rounded-lg border border-black/10 bg-black/2 px-4 py-3 text-sm outline-none transition placeholder:text-black/35 focus:border-black/30 focus:bg-white"
                  rows={4}
                />
              </div>

              {/* Summary */}
              {selectedProduct && quantity && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/75">
                    Request Summary
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-emerald-900">
                    <div className="flex justify-between">
                      <span>Product:</span>
                      <span className="font-semibold">{selectedProduct.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quantity:</span>
                      <span className="font-semibold">{quantity} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Stock:</span>
                      <span className="font-semibold">{selectedProduct.stock}</span>
                    </div>
                    <div className="border-t border-emerald-200 pt-2 flex justify-between">
                      <span>New Stock:</span>
                      <span className="font-bold text-emerald-700">
                        {selectedProduct.stock + Number(quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/admin/stock-requests")}
                  className="flex-1 rounded-lg border border-black/10 bg-white px-6 py-3 font-semibold text-black transition hover:bg-black/3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedProductId || !quantity}
                  className="flex-1 rounded-lg bg-sky-500 px-6 py-3 font-semibold text-white transition hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
