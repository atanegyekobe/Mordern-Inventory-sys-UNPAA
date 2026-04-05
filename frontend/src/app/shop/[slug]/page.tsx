"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import VariantPickerCustomer from "@/components/VariantPickerCustomer";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toAssetUrl } from "@/lib/assets";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/hooks/useToast";
import type { Product, ProductVariant } from "@/lib/types";

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { refreshCart } = useCart();
  const toast = useToast();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  const categoryPath = product?.Category
    ? product.Category.Parent
      ? `${product.Category.Parent.name} / ${product.Category.name}`
      : product.Category.name
    : "Uncategorized";

  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/products/public/slug/${encodeURIComponent(slug)}`);
        const found = response.data.product ?? null;

        if (found) {
          setProduct(found as Product);
        } else {
          setError("Product not found");
        }
      } catch {
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [slug]);

  const handleAddToCart = async () => {
    if (!product) return;

    setAddingToCart(true);
    try {
      if (selectedVariant) {
        await api.post("/cart/items", {
          productId: product.id,
          variantId: selectedVariant.id,
          quantity,
        });
      } else {
        await api.post("/cart/items", {
          productId: product.id,
          quantity,
        });
      }
      await refreshCart();
      toast.success(`Added ${quantity} ${product.name} to cart!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add to cart";
      toast.error(message);
    } finally {
      setAddingToCart(false);
    }
  };

  // Use variant stock if selected, otherwise product stock
  const variantStock = selectedVariant?.stock ?? (product?.stock ?? 0);
  const isOutOfStock = variantStock <= 0;
  const maxQuantity = Math.min(variantStock, 10);
  
  // Use variant price if selected and has custom price, otherwise product price
  const currentPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : Number(product?.price ?? 0);
  const originalPrice = product?.compareAtPrice
    ? Number(product.compareAtPrice)
    : null;
  const hasPriceChange =
    originalPrice !== null &&
    Number.isFinite(originalPrice) &&
    originalPrice > 0 &&
    Number.isFinite(currentPrice) &&
    Math.abs(originalPrice - currentPrice) > 0.001;
  const isDiscount = hasPriceChange && originalPrice! > currentPrice;
  const percentChange = hasPriceChange
    ? Math.round((Math.abs(currentPrice - originalPrice!) / originalPrice!) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <p className="text-black/60">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-red-600 text-lg font-semibold">{error || "Product not found"}</p>
          <button
            onClick={() => router.push("/shop")}
            className="rounded-full border border-black/15 px-6 py-2 text-sm font-semibold hover:bg-black hover:text-white transition"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-amber-50/40 via-white to-sky-50/40">
      <NavBar />
      
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton />
        </div>
        
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-black/60">
          <button onClick={() => router.push("/shop")} className="hover:text-black">
            Shop
          </button>
          <span>/</span>
          <span className="text-black font-medium">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
            {product.imageUrl ? (
              <div className="relative w-full h-125">
                <Image
                  src={toAssetUrl(product.imageUrl)}
                  alt={product.name}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
            ) : (
              <div className="flex h-125 w-full items-center justify-center bg-linear-to-br from-black/5 via-black/10 to-black/15">
                <p className="text-lg text-black/35">No image available</p>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">
              {categoryPath}
            </span>
            
            <h1 className="mt-3 text-4xl font-bold">{product.name}</h1>
            
            <div className="mt-4">
              {hasPriceChange ? (
                <>
                  <p className="text-lg text-black/40 line-through">
                    {formatCurrency(originalPrice!)}
                  </p>
                  <p className="text-3xl font-bold text-black/80">
                    {formatCurrency(currentPrice)}
                  </p>
                  <p className={`mt-1 text-sm font-semibold ${isDiscount ? "text-green-600" : "text-amber-600"}`}>
                    {isDiscount
                      ? `${percentChange}% decrease`
                      : `${percentChange}% increase`}
                  </p>
                </>
              ) : (
                <p className="text-3xl font-bold text-black/80">
                  {formatCurrency(currentPrice)}
                </p>
              )}
            </div>

            {/* Stock Status */}
            <div className="mt-6">
              {isOutOfStock ? (
                <div className="inline-block bg-red-50 text-red-700 px-4 py-2 rounded-lg font-semibold">
                  Out of Stock
                </div>
              ) : product.stock <= 5 ? (
                <div className="inline-block rounded-lg bg-orange-50 px-4 py-2 font-semibold text-orange-700">
                  Only {product.stock} left in stock!
                </div>
              ) : (
                <div className="inline-block rounded-lg bg-emerald-50 px-4 py-2 font-semibold text-emerald-700">
                  In Stock
                </div>
              )}
            </div>

            {/* Variant Picker */}
            <VariantPickerCustomer
              product={product}
              onVariantSelect={setSelectedVariant}
            />

            {/* Description */}
            {product.description && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-3">About this product</h2>
                <p className="whitespace-pre-wrap leading-relaxed text-black/70">
                  {product.description}
                </p>
              </div>
            )}

            {/* Product Details */}
            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="text-lg font-semibold mb-4">Product Details</h2>
              <dl className="space-y-3 text-sm">
                {product.sku && (
                  <>
                    <dt className="inline font-medium text-black">SKU:</dt>
                    <dd className="inline ml-2 text-black/60">{product.sku}</dd>
                    <br />
                  </>
                )}
                <dt className="inline font-medium text-black">Availability:</dt>
                <dd className="inline ml-2 text-black/60">
                  {selectedVariant
                    ? variantStock > 0
                      ? `${variantStock} units`
                      : "Out of stock"
                    : product.stock > 0
                      ? `${product.stock} units`
                      : "Out of stock"}
                </dd>
                <br />
                <dt className="inline font-medium text-black">Category:</dt>
                <dd className="inline ml-2 text-black/60">
                  {categoryPath}
                </dd>
              </dl>
            </div>

            {/* Add to Cart Section */}
            <div className="mt-auto border-t border-black/10 pt-8">
              {/* Show variant warning if product has variants but none selected */}
              {product.ProductVariants &&
                product.ProductVariants.length > 0 &&
                !selectedVariant && (
                  <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
                    Please select options above to add to cart
                  </div>
                )}

              {!isOutOfStock && (
                <div className="flex items-center gap-4 mb-4">
                  <label className="text-sm font-semibold">Quantity:</label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="rounded-xl border border-black/10 px-4 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={
                    isOutOfStock ||
                    addingToCart ||
                    (product.ProductVariants &&
                      product.ProductVariants.length > 0 &&
                      !selectedVariant)
                  }
                  className={`flex-1 rounded-full px-8 py-4 text-base font-semibold transition ${
                    isOutOfStock ||
                    (product.ProductVariants &&
                      product.ProductVariants.length > 0 &&
                      !selectedVariant)
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-linear-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600"
                  }`}
                >
                  {addingToCart
                    ? "Adding..."
                    : isOutOfStock
                      ? "Out of Stock"
                      : product.ProductVariants &&
                          product.ProductVariants.length > 0 &&
                          !selectedVariant
                        ? "Select Options"
                        : "Add to Cart"}
                </button>
                
                <button
                  onClick={() => router.push("/shop")}
                  className="rounded-full border border-black/15 px-6 py-4 text-base font-semibold transition hover:border-black/30 hover:bg-black/5"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section (Optional placeholder) */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold mb-6">You may also like</h2>
          <p className="text-sm text-black/55">
            Browse more products in the <button onClick={() => router.push("/shop")} className="font-semibold text-sky-700 hover:underline">shop</button>
          </p>
        </div>
      </div>
    </div>
  );
}
