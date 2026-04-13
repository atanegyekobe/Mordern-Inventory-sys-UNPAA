"use client";

import { useEffect, useState } from "react";
import AdminPreview from "@/components/AdminPreview";
import Hero from "@/components/Hero";
import NavBar from "@/components/NavBar";
import ProductCard from "@/components/ProductCard";
import api from "@/lib/api";
import { accentForCategory, formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

const highlights = [
  {
    title: "Inventory intelligence",
    copy: "Track stock, reorder thresholds, and best-seller velocity in real time.",
  },
  {
    title: "Order orchestration",
    copy: "Filter orders by status and process fulfillment without leaving the dashboard.",
  },
  {
    title: "Customer moments",
    copy: "Personalized order updates keep customers informed and confident.",
  },
];

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const response = await api.get("/products/public");
        if (isActive) {
          setFeatured((response.data.products ?? []).slice(0, 3));
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
    <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/40 to-cyan-50/60">
      <NavBar />
      <Hero />
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-4 rounded-3xl border border-rose-100 bg-white/80 p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">
              Featured
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Collections that ship fast.
            </h2>
          </div>
          <p className="max-w-md text-sm text-black/60">
            Fresh drops, curated bundles, and seasonal releases. Built for a
            seamless cart experience.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {featured.length > 0 ? (
            featured.map((item) => (
              <ProductCard
                key={item.id}
                id={item.id}
                slug={item.slug}
                name={item.name}
                price={formatCurrency(item.price)}
                tag={item.Category?.Parent?.name || item.Category?.name || "Collection"}
                accent={accentForCategory(item.Category?.Parent?.slug || item.Category?.slug)}
                imageUrl={item.imageUrl}
                stock={item.stock}
              />
            ))
          ) : (
            <div className="md:col-span-3 text-sm text-black/60">
              {status === "error"
                ? "Unable to load featured products."
                : "Loading featured products..."}
            </div>
          )}
        </div>
      </section>
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-black/10 bg-linear-to-br from-white to-rose-50/70 p-6 text-left shadow-sm"
            >
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm text-black/60">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>
      <AdminPreview />
    </div>
  );
}
