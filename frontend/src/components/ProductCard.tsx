"use client";

import Link from "next/link";
import Image from "next/image";
import { toAssetUrl } from "@/lib/assets";

type ProductCardProps = {
  id: string;
  slug: string;
  name: string;
  price: string;
  compareAtPrice?: string;
  tag: string;
  accent: string;
  imageUrl?: string | null;
  stock?: number;
  onAddToCart?: (productId: string) => void;
};

const toNumericPrice = (value: string) => Number(value.replace(/[^\d.-]/g, ""));

export default function ProductCard({ id, slug, name, price, compareAtPrice, tag, accent, imageUrl, stock = 0, onAddToCart }: ProductCardProps) {
  const isOutOfStock = stock <= 0;
  const isOrderingDisabled = !onAddToCart;
  const currentPrice = toNumericPrice(price);
  const originalPrice = compareAtPrice ? toNumericPrice(compareAtPrice) : null;
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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOutOfStock && !isOrderingDisabled && onAddToCart) {
      onAddToCart(id);
    }
  };

  return (
    <Link href={`/shop/${slug}`}>
      <article className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-rose-100 bg-white/95 shadow-sm transition-shadow duration-300 hover:shadow-xl">
        {imageUrl ? (
          <div className="relative h-44 overflow-hidden bg-linear-to-br from-rose-50 to-cyan-50">
            <Image
              src={toAssetUrl(imageUrl)}
              alt={name}
              fill
              unoptimized
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-transparent" />
          </div>
        ) : (
          <div className={`h-44 ${accent} transition duration-500 group-hover:scale-[1.02]`}>
            <div className="h-full w-full bg-linear-to-br from-white/25 to-transparent" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-3 p-6">
          <span className="inline-flex w-fit rounded-full border border-rose-100 bg-rose-50/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700/80">
            {tag}
          </span>
          <h3 className="text-xl font-semibold">{name}</h3>
          {hasPriceChange ? (
            <div>
              <p className="text-sm text-black/40 line-through">{compareAtPrice}</p>
              <p className="text-lg font-semibold text-black/80">{price}</p>
              <p className={`text-xs font-semibold ${isDiscount ? "text-green-600" : "text-amber-600"}`}>
                {isDiscount ? `${percentChange}% OFF` : `${percentChange}% INCREASE`}
              </p>
            </div>
          ) : (
            <p className="text-lg font-semibold text-black/80">{price}</p>
          )}
          {isOutOfStock && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">
              Out of Stock
            </div>
          )}
          {!isOutOfStock && stock > 0 && stock <= 5 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1 text-center text-xs font-semibold text-orange-600">
              Only {stock} left
            </div>
          )}
          <div className="mt-auto flex flex-col gap-2">
            <button 
              onClick={handleAddToCart}
              disabled={isOutOfStock || isOrderingDisabled}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isOutOfStock || isOrderingDisabled
                  ? "border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed"
                  : "border-rose-200 bg-linear-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600"
              }`}
            >
              {isOutOfStock ? "Out of Stock" : isOrderingDisabled ? "Ordering Disabled" : "Add to cart"}
            </button>
            <span className="text-center text-xs text-black/50">or click to view details</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
