"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";
import type { Category } from "@/lib/types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSlug, setEditingSlug] = useState("");

  const loadCategories = async () => {
    try {
      const response = await api.get("/categories");
      setCategories(response.data.categories ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    try {
      await api.post("/categories", {
        name,
        slug: slug ? slugify(slug) : slugify(name),
      });
      setName("");
      setSlug("");
      setMessage("Category created.");
      loadCategories();
    } catch {
      setMessage("Unable to create category.");
    }
  };

  const handleDelete = async (id: string) => {
    setMessage(null);
    try {
      await api.delete(`/categories/${id}`);
      setMessage("Category removed.");
      loadCategories();
    } catch {
      setMessage("Unable to delete category.");
    }
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingSlug(category.slug);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingSlug("");
  };

  const handleUpdate = async (id: string) => {
    setMessage(null);
    try {
      await api.patch(`/categories/${id}`, {
        name: editingName,
        slug: editingSlug ? slugify(editingSlug) : slugify(editingName),
      });
      setMessage("Category updated.");
      cancelEdit();
      loadCategories();
    } catch {
      setMessage("Unable to update category.");
    }
  };

  return (
    <AdminShell title="Categories">
      <div className="flex flex-col gap-6">
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded-2xl border border-black/10 px-4 py-3 text-sm"
            placeholder="Category name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="rounded-2xl border border-black/10 px-4 py-3 text-sm"
            placeholder="Slug (optional)"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <button className="rounded-full bg-black px-4 py-3 text-xs font-semibold text-white">
            Add category
          </button>
        </form>
        {message ? <p className="text-sm text-black/60">{message}</p> : null}
        <div className="overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs uppercase tracking-[0.2em]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length > 0 ? (
                categories.map((category) => (
                  <tr key={category.id} className="border-t border-black/10">
                    <td className="px-4 py-3 font-medium">
                      {editingId === category.id ? (
                        <input
                          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                          value={editingName}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                        />
                      ) : (
                        category.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-black/60">
                      {editingId === category.id ? (
                        <input
                          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                          value={editingSlug}
                          onChange={(event) =>
                            setEditingSlug(event.target.value)
                          }
                        />
                      ) : (
                        category.slug
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === category.id ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold"
                            onClick={() => handleUpdate(category.id)}
                          >
                            Save
                          </button>
                          <button
                            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold"
                            onClick={() => openEdit(category)}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold"
                            onClick={() => handleDelete(category.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-black/10">
                  <td className="px-4 py-6 text-sm text-black/60" colSpan={3}>
                    {status === "error"
                      ? "Login as admin to load categories."
                      : "Loading categories..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
