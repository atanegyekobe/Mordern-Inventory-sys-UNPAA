"use client";

import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import NavBar from "@/components/NavBar";
import { AdminRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toAssetUrl } from "@/lib/assets";
import { useToast } from "@/hooks/useToast";

type PosProduct = {
  id: string;
  name: string;
  price: string | number;
  stock: number;
  image?: string | null;
  CategoryId?: string | null;
  Category?: {
    id: string;
    name: string;
  } | null;
};

type CartLine = PosProduct & {
  quantity: number;
};

type CategoryFilter = "all" | string;

type SaleReceipt = {
  order?: {
    id: string;
    total: string | number;
    totalMinor: number;
    status: string;
    source?: string;
    payment_status?: string;
    order_status?: string;
    createdAt?: string;
  };
  sale: {
    id: string;
    totalAmount: string | number;
    totalAmountMinor: number;
    status: string;
    createdAt?: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    priceAtSale: string | number;
    priceAtSaleMinor: number;
    lineTotal: string | number;
    lineTotalMinor: number;
  }>;
};

const formatMoney = (value: string | number) => formatCurrency(value);

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || "Something went wrong.";
  }

  return "Something went wrong.";
};

export default function PosPage() {
  const toast = useToast();
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [isMaxViewport, setIsMaxViewport] = useState(false);

  const loadProducts = async (search = "") => {
    try {
      setLoadingProducts(true);
      setError(null);

      const response = search
        ? await api.get("/pos/products/search", { params: { q: search } })
        : await api.get("/pos/products");

      setProducts((response.data.products ?? []) as PosProduct[]);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      try {
        setLoadingProducts(true);
        setError(null);

        const response = deferredQuery
          ? await api.get("/pos/products/search", { params: { q: deferredQuery } })
          : await api.get("/pos/products");

        if (isActive) {
          setProducts((response.data.products ?? []) as PosProduct[]);
        }
      } catch (loadError) {
        if (isActive) {
          setError(getErrorMessage(loadError));
          setProducts([]);
        }
      } finally {
        if (isActive) {
          setLoadingProducts(false);
        }
      }
    };

    void run();

    return () => {
      isActive = false;
    };
  }, [deferredQuery]);

  useEffect(() => {
    const handleResize = () => {
      setIsMaxViewport(window.innerWidth >= 1280);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + Number(line.price || 0) * line.quantity, 0);
  const totalItemsText = `${cartCount} item${cartCount === 1 ? "" : "s"}`;

  const receiptTotal = receipt?.sale?.totalAmount ?? receipt?.order?.total ?? subtotal;

  const cartLookup = useMemo(() => new Map(cart.map((line) => [line.id, line])), [cart]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const product of products) {
      if (product.CategoryId && product.Category?.name) {
        map.set(product.CategoryId, {
          id: product.CategoryId,
          name: product.Category.name,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (categoryFilter === "all") return true;
      return String(product.CategoryId || "") === categoryFilter;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, categoryFilter]);

  const addToCart = (product: PosProduct) => {
    if (product.stock <= 0) {
      toast.warning(`${product.name} is out of stock.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.warning(`Only ${product.stock} available for ${product.name}.`);
          return current;
        }
        return current.map((line) =>
          line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });
  };

  const adjustQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.id !== productId) {
            return line;
          }

          const nextQuantity = line.quantity + delta;
          if (nextQuantity <= 0) {
            return null;
          }

          const product = products.find((candidate) => candidate.id === productId) || line;
          if (nextQuantity > product.stock) {
            toast.warning(`Only ${product.stock} available for ${product.name}.`);
            return line;
          }

          return { ...line, quantity: nextQuantity };
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const clearCart = () => {
    setCart([]);
    setReceipt(null);
    setQuery("");
    void loadProducts("");
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.warning("Add at least one item before completing the sale.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post("/pos/sale", {
        items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
      });

      setReceipt(response.data as SaleReceipt);
      setCart([]);
      setQuery("");
      toast.success("Sale completed successfully.");
      await loadProducts("");
    } catch (saleError) {
      toast.error(getErrorMessage(saleError));
    } finally {
      setSubmitting(false);
    }
  };

  const productCards = filteredProducts.map((product) => {
    const inCart = cartLookup.get(product.id);
    return (
      <article
        key={product.id}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-white text-left shadow-[0_8px_20px_-20px_rgba(0,0,0,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_14px_24px_-20px_rgba(0,0,0,0.55)]"
      >
        <div className="relative h-24 overflow-hidden bg-linear-to-br from-amber-50 via-white to-cyan-50">
          {product.image ? (
            <Image
              src={toAssetUrl(product.image)}
              alt={product.name}
              fill
              unoptimized
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.95),rgba(250,250,249,0.85))]">
              <div className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-black/40">
                No image
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-xs font-semibold text-black">{product.name}</h3>
              <p className="mt-1 text-xs font-medium text-black/55">{formatMoney(product.price)}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                product.stock > 5
                  ? "bg-emerald-50 text-emerald-700"
                  : product.stock > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              Stock {product.stock}
            </span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="text-[11px] text-black/45">
              {inCart ? `${inCart.quantity} in cart` : "Tap to add"}
            </span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="rounded-full border border-black/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-black transition hover:bg-black/3"
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => addToCart(product)}
                disabled={isMaxViewport}
                className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition group-hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isMaxViewport ? "Add off" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  });

  return (
    <AdminRoute>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,transparent_26%),radial-gradient(circle_at_top_right,#cffafe_0%,transparent_24%),linear-gradient(180deg,#fafaf9_0%,#f8fafc_100%)]">
        <NavBar />
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8 overflow-x-hidden">
        <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] p-6">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-100/40 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-cyan-100/40 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl min-w-0">
              <BackButton label="Back to admin" className="mb-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">
                Quick sale mode
              </p>
              <p className="mt-2 text-sm font-semibold tracking-[0.08em] text-sky-700">POS quick steps</p>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-black/70">
                <li><span className="font-semibold text-black">1.</span> Search products or SKU, then tap <span className="font-semibold text-black">Add</span>.</li>
                <li><span className="font-semibold text-black">2.</span> Adjust quantities in cart and confirm totals.</li>
                <li><span className="font-semibold text-black">3.</span> Click <span className="font-semibold text-black">Complete Sale</span> to update inventory instantly.</li>
              </ol>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-[0.9fr_1.25fr_0.9fr] lg:max-w-105">
              <div className="rounded-2xl border border-black/10 bg-white/85 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">Items</p>
                <p className="mt-2 text-2xl font-semibold text-black">{cartCount}</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/85 p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">Subtotal</p>
                <p className="mt-2 wrap-break-word text-2xl font-semibold text-black">{formatMoney(subtotal)}</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/85 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">Status</p>
                <p className="mt-2 text-2xl font-semibold text-black">Ready</p>
              </div>
            </div>
          </div>
        </section>

        {receipt && (
          <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] shadow-[0_18px_40px_-28px_rgba(16,185,129,0.55)]">
            <div className="flex flex-col gap-3 border-b border-emerald-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/75">
                  Receipt ready
                </p>
                <h3 className="mt-1 text-xl font-semibold text-black">Sale completed</h3>
              </div>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Close receipt
              </button>
            </div>
            <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-emerald-100 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-black/45">Sale ID</p>
                    <p className="mt-1 break-all font-mono text-xs font-semibold text-black sm:text-sm">{receipt.sale.id}</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {receipt.sale.status}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-black/2 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-black/45">Items</p>
                    <p className="mt-2 text-lg font-semibold text-black">{receipt.items.length}</p>
                  </div>
                  <div className="rounded-2xl bg-black/2 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-black/45">Total</p>
                    <p className="mt-2 text-lg font-semibold text-black">{formatMoney(receiptTotal)}</p>
                  </div>
                  <div className="rounded-2xl bg-black/2 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-black/45">Payment</p>
                    <p className="mt-2 text-lg font-semibold text-black">
                      {receipt.order?.payment_status || "PAID"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-black/10">
                  <table className="min-w-140 divide-y divide-black/10 text-sm">
                    <thead className="bg-black/2">
                      <tr className="text-left text-black/55">
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">Qty</th>
                        <th className="px-4 py-3 font-semibold">Price</th>
                        <th className="px-4 py-3 font-semibold">Line</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 bg-white">
                      {receipt.items.map((item) => (
                        <tr key={`${receipt.sale.id}-${item.productId}`}>
                          <td className="max-w-55 px-4 py-3 font-medium text-black">
                            <span className="block truncate" title={item.productName}>{item.productName}</span>
                          </td>
                          <td className="px-4 py-3 text-black/65">{item.quantity}</td>
                          <td className="px-4 py-3 text-black/65">{formatMoney(item.priceAtSale)}</td>
                          <td className="px-4 py-3 font-semibold text-black">{formatMoney(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Sale summary</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-black/2 px-4 py-3">
                    <span className="text-sm text-black/60">Order status</span>
                    <span className="font-semibold text-black">{receipt.order?.order_status || "COMPLETED"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/2 px-4 py-3">
                    <span className="text-sm text-black/60">Total amount</span>
                    <span className="font-semibold text-black">{formatMoney(receiptTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/2 px-4 py-3">
                    <span className="text-sm text-black/60">Source</span>
                    <span className="font-semibold text-black">{receipt.order?.source || "POS"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  className="mt-5 w-full rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90"
                >
                  Start new sale
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_420px]">
          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Product lookup</p>
                <h3 className="mt-1 text-2xl font-semibold text-black">Search and tap to add</h3>
              </div>
              <div className="w-full space-y-2 sm:max-w-md">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                  Search by name or SKU
                </label>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Start typing a product name or SKU..."
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-black/2 px-4 py-3 text-sm outline-none transition placeholder:text-black/35 focus:border-black/30 focus:bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black"
                  >
                    <option value="all">All categories</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm text-black/55">
              <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span>{loadingProducts ? "Loading products..." : `${filteredProducts.length} of ${products.length} product${products.length === 1 ? "" : "s"} shown`}</span>
                <span className="wrap-break-word break-all text-right sm:max-w-[50%]">{deferredQuery ? `Searching for “${deferredQuery}”` : "Showing all active products"}</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-5">
              {loadingProducts ? (
                <div className="rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3">
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-44 rounded-xl border border-black/10 bg-black/2 animate-pulse" />
                  ))}
                  </div>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3">
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{productCards}</div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-black/15 bg-black/1.5 px-6 py-14 text-center">
                  <p className="text-lg font-semibold text-black">No products match these filters</p>
                  <p className="mt-2 text-sm text-black/55">
                    Try another category or clear the search term.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.45)] xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Current cart</p>
                <h3 className="mt-1 text-2xl font-semibold text-black">Running total</h3>
              </div>
              <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                {totalItemsText}
              </div>
            </div>

            {cart.length > 0 ? (
              <div className="mt-4 space-y-3">
                {cart.map((line) => (
                  <div key={line.id} className="rounded-2xl border border-black/10 bg-black/1.5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                        {line.image ? (
                          <Image
                            src={toAssetUrl(line.image)}
                            alt={line.name}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-black" title={line.name}>{line.name}</p>
                            <p className="mt-1 text-xs text-black/50">{formatMoney(line.price)} each</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => adjustQuantity(line.id, -line.quantity)}
                            className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-full border border-black/10 bg-white p-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => adjustQuantity(line.id, -1)}
                              className="h-8 w-8 rounded-full text-lg font-semibold text-black/60 transition hover:bg-black hover:text-white"
                            >
                              −
                            </button>
                            <span className="w-10 text-center text-sm font-semibold text-black">{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => adjustQuantity(line.id, 1)}
                              className="h-8 w-8 rounded-full text-lg font-semibold text-black/60 transition hover:bg-black hover:text-white"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-black/40">Line total</p>
                            <p className="text-sm font-semibold text-black">
                              {formatMoney(Number(line.price) * line.quantity)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-black/1.5 p-6 text-center">
                <p className="text-sm font-semibold text-black">Cart is empty</p>
                <p className="mt-1 text-sm text-black/55">Tap products on the left to start a quick sale.</p>
              </div>
            )}

            <div className="mt-5 space-y-3 rounded-3xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] p-5">
              <div className="flex items-center justify-between text-sm text-black/60">
                <span>Status</span>
                <span className="font-semibold text-black">Ready</span>
              </div>
              <div className="flex items-center justify-between text-sm text-black/60">
                <span>Items</span>
                <span className="font-semibold text-black">{cartCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-black/60">
                <span>Subtotal</span>
                <span className="font-semibold text-black">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-black/10 pt-3 text-lg font-semibold text-black">
                <span>Total</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <button
                type="button"
                onClick={completeSale}
                disabled={submitting || cart.length === 0}
                className="mt-2 w-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(16,185,129,0.75)] transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Completing sale..." : "Complete Sale"}
              </button>
              <button
                type="button"
                onClick={clearCart}
                disabled={cart.length === 0}
                className="w-full rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear cart
              </button>
            </div>
          </aside>
        </section>

        {selectedProduct && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-product-details-title"
            onClick={() => setSelectedProduct(null)}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                <h3 id="pos-product-details-title" className="text-base font-semibold text-black">Product details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-semibold text-black transition hover:bg-black/3"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="relative h-44 overflow-hidden rounded-xl border border-black/10 bg-black/2">
                  {selectedProduct.image ? (
                    <Image
                      src={toAssetUrl(selectedProduct.image)}
                      alt={selectedProduct.name}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 420px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                      No image
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-lg font-semibold text-black">{selectedProduct.name}</p>
                  <p className="mt-1 text-sm text-black/60">Quick stock and pricing snapshot before you add to cart.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-black/10 bg-black/2 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">Price</p>
                    <p className="mt-1 text-sm font-semibold text-black">{formatMoney(selectedProduct.price)}</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-black/2 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">Stock</p>
                    <p className="mt-1 text-sm font-semibold text-black">{selectedProduct.stock} available</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="w-full rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/90"
                >
                  Add to cart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
    </AdminRoute>
  );
}
