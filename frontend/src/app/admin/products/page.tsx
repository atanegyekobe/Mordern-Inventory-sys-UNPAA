"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import PaginationControls from "@/components/PaginationControls";
import VariantManager from "@/components/VariantManager";
import api from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/format";
import type { Category, Product, ProductVariant } from "@/lib/types";

const PAGE_SIZE = 10;

const formatStatus = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

interface BulkEditState {
  [productId: string]: {
    price?: string;
    stock?: string;
    categoryId?: string;
    status?: string;
  };
}

export default function AdminProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [showForm, setShowForm] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEdits, setBulkEdits] = useState<BulkEditState>({});
  const [editing, setEditing] = useState<Product | null>(null);
  const [currentVariants, setCurrentVariants] = useState<ProductVariant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiTone, setAiTone] = useState("neutral");
  const [aiLength, setAiLength] = useState("medium");
  const [aiFeatures, setAiFeatures] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    price: "",
    cost: "",
    sku: "",
    stock: "0",
    status: "active",
    categoryId: "",
  });
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Bulk operation state
  const [bulkPriceOp, setBulkPriceOp] = useState<"increase" | "decrease" | "set">("set");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState("");

  // View filter state
  const [viewMode, setViewMode] = useState<"active" | "trash">("active");
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async () => {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        api.get("/products?includeAll=true"),
        api.get("/categories"),
      ]);
      setProducts(productsResponse.data.products ?? []);
      setCategories(categoriesResponse.data.categories ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time validation
  useEffect(() => {
    const warnings: string[] = [];

    // Check price vs cost
    if (formState.price && formState.cost) {
      const price = parseFloat(formState.price);
      const cost = parseFloat(formState.cost);
      if (cost > 0 && price < cost) {
        warnings.push("⚠️ Price is less than cost - this will result in a loss.");
      }
    }

    // Check description
    if (!formState.description || formState.description.trim().length === 0) {
      warnings.push("📝 Missing description - add one for better SEO and customer information.");
    }

    setValidationWarnings(warnings);
  }, [formState.price, formState.cost, formState.description]);

  useEffect(() => {
    if (!formState.categoryId && categories.length > 0) {
      setFormState((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, formState.categoryId]);

  const resetForm = () => {
    setFormState({
      name: "",
      description: "",
      price: "",
      cost: "",
      sku: "",
      stock: "0",
      status: "active",
      categoryId: categories[0]?.id ?? "",
    });
    setCurrentVariants([]);
    setAiFeatures("");
    setAiError(null);
    setImageFile(null);
    setEditing(null);
    setValidationWarnings([]);
    setServerWarnings([]);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    const maybeCost =
      "cost" in product
        ? (product as Record<string, unknown>).cost
        : undefined;
    const normalizedCost =
      typeof maybeCost === "string" || typeof maybeCost === "number"
        ? maybeCost
        : "";

    setEditing(product);
    setFormState({
      name: product.name,
      description: product.description ?? "",
      price: String(product.price ?? ""),
      cost: String(normalizedCost),
      sku: product.sku ?? "",
      stock: String(product.stock ?? 0),
      status: product.status ?? "active",
      categoryId: product.CategoryId ?? product.Category?.id ?? "",
    });
    setCurrentVariants(product.ProductVariants ?? []);
    setImageFile(null);
    setShowForm(true);
    setValidationWarnings([]);
    setServerWarnings([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setServerWarnings([]);

    const payload = new FormData();
    payload.append("name", formState.name);
    payload.append("description", formState.description);
    payload.append("price", formState.price);
    payload.append("cost", formState.cost);
    payload.append("sku", formState.sku);
    payload.append("stock", formState.stock);
    payload.append("status", formState.status);
    payload.append("categoryId", formState.categoryId);
    if (imageFile) {
      payload.append("image", imageFile);
    }

    try {
      if (editing) {
        const response = await api.patch(`/products/${editing.id}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Product updated successfully!");
        if (response.data.warnings && response.data.warnings.length > 0) {
          setServerWarnings(response.data.warnings);
          toast.info("Check warnings below before saving again.");
        }
      } else {
        const response = await api.post("/products", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Product created successfully!");
        if (response.data.warnings && response.data.warnings.length > 0) {
          setServerWarnings(response.data.warnings);
          toast.info("Check warnings below.");
        }
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch {
      toast.error("Unable to save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm("Move product to trash? You can restore it anytime.")) {
      return;
    }
    try {
      await api.patch(`/products/${productId}`, { status: "draft" });
      toast.success("Product moved to trash!");
      loadData();
    } catch {
      toast.error("Failed to move product to trash.");
    }
  };

  const handleRestore = async (productId: string) => {
    try {
      await api.patch(`/products/${productId}`, { status: "active" });
      toast.success("Product restored successfully!");
      loadData();
    } catch {
      toast.error("Failed to restore product.");
    }
  };

  const handleGenerateDraft = async () => {
    if (!formState.name.trim()) {
      toast.warning("Add a product name to generate a draft.");
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const categoryName =
        categories.find((category) => category.id === formState.categoryId)
          ?.name || "";
      const response = await api.post("/ai/product-draft", {
        name: formState.name,
        category: categoryName,
        price: formState.price,
        keyFeatures: aiFeatures,
        tone: aiTone,
        length: aiLength,
      });

      const draft = response.data?.draft;
      if (draft) {
        setFormState((prev) => ({
          ...prev,
          name: prev.name || draft.title || prev.name,
          description: draft.longDescription || prev.description,
        }));
        toast.success("AI draft generated!");
      }
    } catch {
      toast.error("Failed to generate AI draft. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  // Bulk edit handlers
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (productId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedIds(newSelected);
  };

  const handleInlineEdit = (
    productId: string,
    field: string,
    value: string
  ) => {
    setBulkEdits((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const applyBulkPriceUpdate = async () => {
    if (!bulkPriceValue || selectedIds.size === 0) {
      toast.warning("Select products and enter a value.");
      return;
    }

    try {
      await api.patch("/products/bulk/price", {
        productIds: Array.from(selectedIds),
        operation: bulkPriceOp,
        value: parseFloat(bulkPriceValue),
      });
      toast.success(`Prices updated for ${selectedIds.size} products!`);
      setBulkPriceValue("");
      setSelectedIds(new Set());
      loadData();
    } catch {
      toast.error("Failed to update prices.");
    }
  };

  const applyBulkCategoryUpdate = async () => {
    if (!bulkCategoryId || selectedIds.size === 0) {
      toast.warning("Select products and a category.");
      return;
    }

    try {
      await api.patch("/products/bulk/category", {
        productIds: Array.from(selectedIds),
        categoryId: bulkCategoryId,
      });
      toast.success(`Category updated for ${selectedIds.size} products!`);
      setBulkCategoryId("");
      setSelectedIds(new Set());
      loadData();
    } catch {
      toast.error("Failed to update categories.");
    }
  };

  const applyBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Select products to move to trash.");
      return;
    }

    if (
      !window.confirm(
        `Move ${selectedIds.size} product(s) to trash? You can restore them anytime.`
      )
    ) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.patch(`/products/${id}`, { status: "draft" })
        )
      );
      toast.success(`Moved ${selectedIds.size} product(s) to trash!`);
      setSelectedIds(new Set());
      loadData();
    } catch {
      toast.error("Failed to move products to trash.");
    }
  };

  const applyBulkRestore = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Select products to restore.");
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.patch(`/products/${id}`, { status: "active" })
        )
      );
      toast.success(`Restored ${selectedIds.size} product(s)!`);
      setSelectedIds(new Set());
      loadData();
    } catch {
      toast.error("Failed to restore products.");
    }
  };

  // Filter products based on view mode
  const filteredProducts = products.filter(
    (p) => (viewMode === "active" ? p.status === "active" : p.status === "draft")
  );
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedFilteredProducts = filteredProducts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, bulkMode]);

  return (
    <AdminShell title="Products">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_transparent_42%),radial-gradient(circle_at_top_right,_#fde68a_0%,_transparent_36%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5">
        <div className="absolute -right-10 -top-8 h-28 w-28 rounded-full bg-cyan-200/35 blur-2xl" />
        <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55">Catalog Control</p>
          <p className="mt-2 text-sm text-black/65">
            Manage products, variants, and stock posture from a single workspace.
          </p>
        </div>
      </section>

      {/* View Mode Tabs */}
      <div className="mt-6 mb-6 flex gap-2 border-b border-black/10 pb-1">
        <button
          onClick={() => {
            setViewMode("active");
            setSelectedIds(new Set());
            setBulkEdits({});
          }}
          className={`rounded-t-xl px-4 py-3 text-sm font-semibold transition-colors ${
            viewMode === "active"
              ? "border-b-2 border-black bg-black text-white"
              : "text-black/60 hover:bg-black/[0.04] hover:text-black"
          }`}
        >
          Active Products ({products.filter((p) => p.status === "active").length})
        </button>
        <button
          onClick={() => {
            setViewMode("trash");
            setSelectedIds(new Set());
            setBulkEdits({});
          }}
          className={`rounded-t-xl px-4 py-3 text-sm font-semibold transition-colors ${
            viewMode === "trash"
              ? "border-b-2 border-black bg-black text-white"
              : "text-black/60 hover:bg-black/[0.04] hover:text-black"
          }`}
        >
          Trash ({products.filter((p) => p.status === "draft").length})
        </button>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black/60">
          {bulkMode
            ? `Select multiple ${viewMode} products to edit in bulk.`
            : viewMode === "active"
              ? "Review catalog status and restock alerts."
              : "View deleted products. Restore anytime."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              setSelectedIds(new Set());
              setBulkEdits({});
            }}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              bulkMode
                ? "bg-black text-white"
                : "border border-black/10 bg-white hover:border-black/30 hover:bg-black hover:text-white"
            }`}
          >
            {bulkMode ? "Exit Bulk" : "Bulk Edit"}
          </button>
          {!bulkMode && viewMode === "active" && (
            <button
              onClick={openCreate}
              className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:bg-black/85"
            >
              Add product
            </button>
          )}
          {bulkMode && viewMode === "trash" && selectedIds.size > 0 && (
            <button
              onClick={applyBulkRestore}
              className="rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
            >
              Restore ({selectedIds.size})
            </button>
          )}
        </div>
      </div>
      </div>
      {showForm && !bulkMode ? (
        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-4 rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-6 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.45)]"
        >
          {/* Validation Warnings */}
          {(validationWarnings.length > 0 || serverWarnings.length > 0) && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-yellow-900">
                ⚠️ Warnings
              </p>
              <ul className="space-y-1">
                {validationWarnings.map((warning, idx) => (
                  <li key={`val-${idx}`} className="text-xs text-yellow-800">
                    {warning}
                  </li>
                ))}
                {serverWarnings.map((warning, idx) => (
                  <li key={`srv-${idx}`} className="text-xs text-yellow-800">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              Name
              <input
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              Price
              <input
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm"
                type="number"
                step="0.01"
                value={formState.price}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    price: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              Cost (Optional)
              <input
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm"
                type="number"
                step="0.01"
                value={formState.cost}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    cost: event.target.value,
                  }))
                }
                placeholder="Cost of goods sold"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              Stock
              <input
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm"
                type="number"
                value={formState.stock}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    stock: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              Category
              <select
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                value={formState.categoryId}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    categoryId: event.target.value,
                  }))
                }
                required
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              SKU
              <input
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm"
                value={formState.sku}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    sku: event.target.value,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
              Status
              <select
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                value={formState.status}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
            Description
            <textarea
              className="min-h-30 rounded-2xl border border-black/10 px-4 py-3 text-sm"
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <div className="rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                  AI Draft
                </p>
                <p className="text-xs text-black/50">
                  Generate a draft description from name and features.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={aiLoading}
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {aiLoading ? "Generating..." : "Generate"}
              </button>
            </div>
            {aiError && (
              <p className="mt-2 text-xs text-red-600">{aiError}</p>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                Tone
                <select
                  className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                  value={aiTone}
                  onChange={(event) => setAiTone(event.target.value)}
                >
                  <option value="neutral">Neutral</option>
                  <option value="premium">Premium</option>
                  <option value="playful">Playful</option>
                  <option value="minimal">Minimal</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                Length
                <select
                  className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                  value={aiLength}
                  onChange={(event) => setAiLength(event.target.value)}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                Key features
                <input
                  className="rounded-2xl border border-black/10 px-3 py-2 text-sm"
                  value={aiFeatures}
                  onChange={(event) => setAiFeatures(event.target.value)}
                  placeholder="e.g., lightweight, waterproof"
                />
              </label>
            </div>
          </div>
          
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.45)]">
            {editing ? (
              <VariantManager
                productId={editing.id}
                categoryId={editing.CategoryId || formState.categoryId}
                variants={currentVariants}
                parentPrice={parseFloat(formState.price) || 0}
                onVariantsChange={setCurrentVariants}
              />
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                  Product Variants
                </p>
                <p className="mt-2 text-sm text-black/60">
                  Save the product first to add variants. After creating, you can edit the product and add size, color, or other variations.
                </p>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
            Product image
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                setImageFile(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-full bg-black px-6 py-3 text-xs font-semibold text-white"
              disabled={isSubmitting}
            >
              {editing ? "Update product" : "Create product"}
            </button>
            <button
              type="button"
              className="rounded-full border border-black/10 px-6 py-3 text-xs font-semibold"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {bulkMode ? (
        <div className="mt-6 space-y-4">
          {/* Bulk action toolbars */}
          <div className="space-y-3 rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between text-xs">
              <p className="font-semibold text-black/70">
                Selected: {selectedIds.size} products
              </p>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => {
                    setSelectedIds(new Set());
                    setBulkEdits({});
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Clear selection
                </button>
              )}
            </div>

            {/* Price update toolbar */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-40">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                  Price Action
                </label>
                <select
                  value={bulkPriceOp}
                  onChange={(e) =>
                    setBulkPriceOp(
                      e.target.value as "increase" | "decrease" | "set"
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="increase">Increase by %</option>
                  <option value="decrease">Decrease by %</option>
                  <option value="set">Set to</option>
                </select>
              </div>
              <div className="flex-1 min-w-24">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Value"
                  value={bulkPriceValue}
                  onChange={(e) => setBulkPriceValue(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={applyBulkPriceUpdate}
                disabled={selectedIds.size === 0 || !bulkPriceValue}
                className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Apply Price
              </button>
            </div>

            {/* Category update toolbar */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-40">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                  Category
                </label>
                <select
                  value={bulkCategoryId}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={applyBulkCategoryUpdate}
                disabled={selectedIds.size === 0 || !bulkCategoryId}
                className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Apply Category
              </button>
            </div>

            {/* Delete toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={applyBulkDelete}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Delete {selectedIds.size} products
                </button>
                <button
                  onClick={() => {
                    setSelectedIds(new Set());
                    setBulkEdits({});
                  }}
                  className="rounded-lg border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-black/75 hover:border-black/30 hover:bg-black hover:text-white"
                >
                  Cancel Selection
                </button>
              </div>
            )}
          </div>

          {/* Bulk editing table */}
          <div className="overflow-hidden rounded-2xl border border-black/10 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.55)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-xs uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length > 0 ? (
                  paginatedFilteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={`border-t border-black/10 ${
                        selectedIds.has(product.id) ? "bg-cyan-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={
                            bulkEdits[product.id]?.price ?? product.price
                          }
                          onChange={(e) =>
                            handleInlineEdit(product.id, "price", e.target.value)
                          }
                          disabled={!selectedIds.has(product.id)}
                          className="w-24 rounded border border-black/10 px-2 py-1 text-sm disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={
                            bulkEdits[product.id]?.stock ?? product.stock
                          }
                          onChange={(e) =>
                            handleInlineEdit(product.id, "stock", e.target.value)
                          }
                          disabled={!selectedIds.has(product.id)}
                          className="w-20 rounded border border-black/10 px-2 py-1 text-sm disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={
                            bulkEdits[product.id]?.categoryId ??
                            product.CategoryId ??
                            ""
                          }
                          onChange={(e) =>
                            handleInlineEdit(
                              product.id,
                              "categoryId",
                              e.target.value
                            )
                          }
                          disabled={!selectedIds.has(product.id)}
                          className="rounded border border-black/10 px-2 py-1 text-sm disabled:bg-gray-100"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-black/10">
                    <td
                      className="px-4 py-6 text-sm text-black/60"
                      colSpan={5}
                    >
                      {status === "error"
                        ? "Login as admin to load products."
                        : "Loading products..."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Normal view table
        <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.5)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-xs uppercase tracking-[0.2em]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                paginatedFilteredProducts.map((product) => {
                  const statusLabel =
                    product.stock < 8 ? "Low" : formatStatus(product.status);
                  return (
                    <tr key={product.id} className="border-t border-black/10">
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 py-3">{product.stock}</td>
                      <td className="px-4 py-3">{statusLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {viewMode === "active" && (
                            <button
                              className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold hover:border-black/20"
                              onClick={() => openEdit(product)}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              viewMode === "trash"
                                ? "border-green-200 text-green-600 hover:border-green-300"
                                : "border-black/10 text-red-600 hover:border-red-200"
                            }`}
                            onClick={() =>
                              viewMode === "trash"
                                ? handleRestore(product.id)
                                : handleDelete(product.id)
                            }
                          >
                            {viewMode === "trash" ? "Restore" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-black/10">
                  <td className="px-4 py-6 text-sm text-black/60" colSpan={5}>
                    {status === "error"
                      ? "Login as admin to load products."
                      : "Loading products..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <PaginationControls
        totalItems={filteredProducts.length}
        currentPage={safePage}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemLabel="products"
        className="mt-4"
      />
    </AdminShell>
  );
}