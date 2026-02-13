"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import ProductCard from "@/components/ProductCard";
import api from "@/lib/api";
import { accentForCategory, formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const response = await api.get("/products");
        if (isActive) {
          setProducts(response.data.products ?? []);
          setStatus("ready");
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
  }, []);

  return (
    <div className="min-h-screen">
      <NavBar />
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h1 className="text-4xl font-semibold">Shop the latest drops.</h1>
        <p className="mt-3 max-w-2xl text-sm text-black/60">
          Explore curated collections, limited runs, and ready-to-ship bundles.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {products.length > 0
            ? products.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  price={formatCurrency(product.price)}
                  tag={product.Category?.name ?? "Collection"}
                  accent={accentForCategory(product.Category?.slug)}
                />
              ))
            : (
                <div className="col-span-full text-sm text-black/60">
                  {status === "error"
                    ? "Unable to load products."
                    : "Loading products..."}
                </div>
              )}
        </div>
      </section>
    </div>
  );
}
