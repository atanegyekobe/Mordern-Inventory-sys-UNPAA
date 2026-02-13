"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";
import type { Category, Product } from "@/lib/types";

const formatStatus = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    price: "",
    sku: "",
    stock: "0",
    status: "active",
    categoryId: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const loadData = async () => {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        api.get("/products"),
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
      sku: "",
      stock: "0",
      status: "active",
      categoryId: categories[0]?.id ?? "",
    });
    setImageFile(null);
    setEditing(null);
  };

  const openCreate = () => {
    setMessage(null);
    resetForm();
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setMessage(null);
    setEditing(product);
    setFormState({
      name: product.name,
      description: product.description ?? "",
      price: String(product.price ?? ""),
      sku: product.sku ?? "",
      stock: String(product.stock ?? 0),
      status: product.status ?? "active",
      categoryId: product.CategoryId ?? product.Category?.id ?? "",
    });
    setImageFile(null);
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const payload = new FormData();
    payload.append("name", formState.name);
    payload.append("description", formState.description);
    payload.append("price", formState.price);
    payload.append("sku", formState.sku);
    payload.append("stock", formState.stock);
    payload.append("status", formState.status);
    payload.append("categoryId", formState.categoryId);
    if (imageFile) {
      payload.append("image", imageFile);
    }

    try {
      if (editing) {
        await api.patch(`/products/${editing.id}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Product updated.");
      } else {
        await api.post("/products", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Product created.");
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch {
      setMessage("Unable to save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    setMessage(null);
    try {
      await api.delete(`/products/${productId}`);
      setMessage("Product deleted.");
      loadData();
    } catch {
      setMessage("Unable to delete product.");
    }
  };

  return (
    <AdminShell title="Products">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black/60">
          Review catalog status and restock alerts.
        </p>
        <button
          onClick={openCreate}
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
        >
          Add product
        </button>
      </div>
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-4 rounded-2xl border border-black/10 bg-white p-6"
        >
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
              className="min-h-[120px] rounded-2xl border border-black/10 px-4 py-3 text-sm"
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </label>
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
      {message ? <p className="mt-4 text-sm text-black/60">{message}</p> : null}
      <div className="mt-6 overflow-hidden rounded-2xl border border-black/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/5 text-xs uppercase tracking-[0.2em]">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((product) => {
                const statusLabel =
                  product.stock < 8 ? "Low" : formatStatus(product.status);
                return (
                  <tr key={product.id} className="border-t border-black/10">
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="px-4 py-3">{product.stock}</td>
                    <td className="px-4 py-3">{statusLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold"
                          onClick={() => openEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold"
                          onClick={() => handleDelete(product.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="border-t border-black/10">
                <td className="px-4 py-6 text-sm text-black/60" colSpan={4}>
                  {status === "error"
                    ? "Login as admin to load products."
                    : "Loading products..."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
