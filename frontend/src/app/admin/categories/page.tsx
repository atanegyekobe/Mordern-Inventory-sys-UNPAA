"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import type { Category } from "@/lib/types";

const PAGE_SIZE = 10;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function AdminCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const [editingParentId, setEditingParentId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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
    let active = true;

    api
      .get("/categories")
      .then((response) => {
        if (!active) return;
        setCategories(response.data.categories ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await api.post("/categories", {
        name,
        slug: slug ? slugify(slug) : slugify(name),
        parentId: parentId || null,
      });
      setName("");
      setSlug("");
      setParentId("");
      toast.success("Category created!");
      loadCategories();
    } catch {
      toast.error("Unable to create category.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/categories/${id}`);
      toast.success("Category deleted!");
      loadCategories();
    } catch {
      toast.error("Unable to delete category.");
    }
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingSlug(category.slug);
    setEditingParentId(category.ParentId ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingSlug("");
    setEditingParentId("");
  };

  const handleUpdate = async (id: string) => {
    if (editingParentId && editingParentId === id) {
      toast.error("A category cannot be its own parent.");
      return;
    }

    try {
      await api.patch(`/categories/${id}`, {
        name: editingName,
        slug: editingSlug ? slugify(editingSlug) : slugify(editingName),
        parentId: editingParentId || null,
      });
      toast.success("Category updated!");
      cancelEdit();
      loadCategories();
    } catch {
      toast.error("Unable to update category.");
    }
  };

  const rootCategories = categories
    .filter((category) => !category.ParentId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const subCategories = categories
    .filter((category) => Boolean(category.ParentId))
    .sort((a, b) => a.name.localeCompare(b.name));

  const groupedCategories = rootCategories.flatMap((rootCategory) => {
    const children = subCategories
      .filter((subCategory) => subCategory.ParentId === rootCategory.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    return [rootCategory, ...children];
  });

  const orphanSubCategories = subCategories.filter(
    (subCategory) => !rootCategories.some((rootCategory) => rootCategory.id === subCategory.ParentId)
  );

  const displayCategories = [...groupedCategories, ...orphanSubCategories];
  const totalPages = Math.max(1, Math.ceil(displayCategories.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedCategories = displayCategories.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <AdminShell title="Categories">
      <div className="flex flex-col gap-6">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="rounded-2xl border border-black/10 bg-black/2 px-4 py-3 text-sm text-black/65">
            Create a main category by leaving Parent empty. To create a subcategory, choose a parent category.
          </div>

          <div className="grid gap-3 md:grid-cols-4">
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
            <select
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">No parent (Main category)</option>
              {rootCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button className="rounded-full bg-black px-4 py-3 text-xs font-semibold text-white">
              Add category
            </button>
          </div>
        </form>
        <div className="overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs uppercase tracking-[0.2em]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length > 0 ? (
                paginatedCategories.map((category) => (
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
                        <div className={category.ParentId ? "pl-5" : ""}>
                          <p className="font-medium">{category.name}</p>
                          {category.Parent?.name && (
                            <p className="text-xs text-black/55">Subcategory under {category.Parent.name}</p>
                          )}
                        </div>
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
                    <td className="px-4 py-3 text-black/60">
                      {category.ParentId ? (
                        <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">Subcategory</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Main</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-black/60">
                      {editingId === category.id ? (
                        <select
                          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                          value={editingParentId}
                          onChange={(event) => setEditingParentId(event.target.value)}
                        >
                          <option value="">Top-level</option>
                          {rootCategories
                            .filter((rootCategory) => rootCategory.id !== category.id)
                            .map((rootCategory) => (
                              <option key={`edit-${rootCategory.id}`} value={rootCategory.id}>
                                {rootCategory.name}
                              </option>
                            ))}
                        </select>
                      ) : category.Parent?.name ? (
                        category.Parent.name
                      ) : (
                        <span className="text-black/40">Top-level</span>
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
                  <td className="px-4 py-6 text-sm text-black/60" colSpan={5}>
                    {status === "error"
                      ? "Login as admin to load categories."
                      : "Loading categories..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          totalItems={displayCategories.length}
          currentPage={safePage}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="categories"
        />
      </div>
    </AdminShell>
  );
}
