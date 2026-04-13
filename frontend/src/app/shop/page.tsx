"use client";

import { useEffect, useMemo, useState } from "react";
import NavBar from "@/components/NavBar";
import ProductCard from "@/components/ProductCard";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";
import { accentForCategory, formatCurrency } from "@/lib/format";
import type { Product, Category } from "@/lib/types";

const PAGE_SIZE = 10;

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const productsRes = await api.get("/products/public");
        if (isActive) {
          const nextProducts = productsRes.data.products ?? [];
          setProducts(nextProducts);

          const categoriesMap = new Map<string, Category>();
          nextProducts.forEach((product: Product) => {
            const category = product.Category;
            if (!category) {
              return;
            }

            const topCategory = category.Parent || category;
            if (topCategory?.id && !categoriesMap.has(topCategory.id)) {
              categoriesMap.set(topCategory.id, topCategory);
            }
          });
          setCategories(Array.from(categoriesMap.values()));
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

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return products;
    }

    return products.filter((product) => {
      const category = product.Category;
      if (!category) {
        return false;
      }

      const topCategoryId = category.Parent?.id || category.id;
      return topCategoryId === selectedCategory;
    });
  }, [products, selectedCategory]);

  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safeProductPage = Math.min(productsPage, totalProductPages);
  const paginatedProducts = filteredProducts.slice(
    (safeProductPage - 1) * PAGE_SIZE,
    safeProductPage * PAGE_SIZE
  );

  const totalCategoryPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
  const safeCategoryPage = Math.min(categoriesPage, totalCategoryPages);
  const paginatedCategories = categories.slice(
    (safeCategoryPage - 1) * PAGE_SIZE,
    safeCategoryPage * PAGE_SIZE
  );

  return (
    <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/50 to-cyan-50/60">
      <NavBar />
      <section className="mx-auto w-full max-w-7xl px-6 py-16">
        <div className="mb-8 rounded-3xl border border-rose-100 bg-linear-to-r from-rose-100/80 via-amber-50 to-cyan-100/80 p-6 shadow-sm">
          <h1 className="text-4xl font-semibold text-black/90">Shop the latest drops.</h1>
          <p className="mt-3 max-w-2xl text-sm text-black/65">
            Explore curated collections, limited runs, and ready-to-ship bundles.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Category Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-20 rounded-2xl border border-rose-100 bg-white/90 p-6 shadow-sm backdrop-blur">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-black/60">
                Categories
              </h2>
              <nav className="space-y-2 flex flex-col">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setProductsPage(1);
                  }}
                  className={`text-left rounded-lg px-3 py-2 text-sm transition ${
                    selectedCategory === null
                      ? "bg-linear-to-r from-rose-500 to-orange-500 text-white font-semibold"
                      : "text-black/60 hover:bg-rose-50"
                  }`}
                >
                  All Products
                </button>
                {paginatedCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setProductsPage(1);
                    }}
                    className={`text-left rounded-lg px-3 py-2 text-sm transition ${
                      selectedCategory === category.id
                        ? "bg-linear-to-r from-rose-500 to-orange-500 text-white font-semibold"
                        : "text-black/60 hover:bg-rose-50"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>
              <PaginationControls
                totalItems={categories.length}
                currentPage={safeCategoryPage}
                pageSize={PAGE_SIZE}
                onPageChange={setCategoriesPage}
                itemLabel="categories"
              />
              <div className="mt-6 border-t border-black/10 pt-4">
                <p className="text-xs text-black/50">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <div className="lg:col-span-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.length > 0
                ? paginatedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      slug={product.slug}
                      name={product.name}
                      price={formatCurrency(product.price)}
                      compareAtPrice={
                        product.compareAtPrice
                          ? formatCurrency(product.compareAtPrice)
                          : undefined
                      }
                      tag={product.Category?.Parent?.name || product.Category?.name || "Collection"}
                      accent={accentForCategory(product.Category?.Parent?.slug || product.Category?.slug)}
                      imageUrl={product.imageUrl}
                      stock={product.stock}
                    />
                  ))
                : (
                    <div className="col-span-full text-sm text-black/60 py-12 text-center">
                      {status === "error"
                        ? "Unable to load products."
                        : status === "loading"
                        ? "Loading products..."
                        : "No products found in this category."}
                    </div>
                  )}
            </div>
            <PaginationControls
              totalItems={filteredProducts.length}
              currentPage={safeProductPage}
              pageSize={PAGE_SIZE}
              onPageChange={setProductsPage}
              itemLabel="products"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
