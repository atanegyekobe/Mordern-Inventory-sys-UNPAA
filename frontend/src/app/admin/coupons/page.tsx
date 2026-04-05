"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PaginationControls from "@/components/PaginationControls";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

const PAGE_SIZE = 10;

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export default function CouponsPage() {
  const router = useRouter();
  const toast = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage",
    value: 0,
    minPurchase: 0,
    maxDiscount: "",
    usageLimit: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (searchTerm) params.append("search", searchTerm);

      const response = await api.get(`/coupons?${params.toString()}`);
      setCoupons(response.data);
    } catch (err: unknown) {
      console.error("Failed to fetch coupons:", err);
      const statusCode = (err as { response?: { status?: number } })?.response
        ?.status;
      if (statusCode === 401) {
        setError("Please login as admin");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError("Failed to load coupons");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      };

      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon.id}`, payload);
        toast.success("Coupon updated successfully!");
      } else {
        await api.post("/coupons", payload);
        toast.success("Coupon created successfully!");
      }

      setShowModal(false);
      setEditingCoupon(null);
      resetForm();
      fetchCoupons();
    } catch (error: unknown) {
      const responseError = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(responseError || "Failed to save coupon");
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minPurchase: coupon.minPurchase,
      maxDiscount: coupon.maxDiscount?.toString() || "",
      usageLimit: coupon.usageLimit?.toString() || "",
      startDate: coupon.startDate
        ? new Date(coupon.startDate).toISOString().split("T")[0]
        : "",
      endDate: coupon.endDate
        ? new Date(coupon.endDate).toISOString().split("T")[0]
        : "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;

    try {
      await api.delete(`/coupons/${id}`);
      toast.success("Coupon deleted successfully!");
      fetchCoupons();
    } catch (error: unknown) {
      const responseError = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(responseError || "Failed to delete coupon");
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      type: "percentage",
      value: 0,
      minPurchase: 0,
      maxDiscount: "",
      usageLimit: "",
      startDate: "",
      endDate: "",
    });
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    resetForm();
    setShowModal(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCoupons = coupons.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="rounded-3xl border border-black/10 bg-linear-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Promotions Workspace</p>
            <h1 className="mt-1 text-3xl font-semibold text-black md:text-4xl">Coupons</h1>
            <p className="mt-2 text-sm text-black/65">Manage campaign discounts, usage limits, and coupon life cycles.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Create Coupon
            </button>
            <button
              onClick={() => router.push("/admin")}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black/75 transition hover:border-black/30 hover:bg-black/5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Back to Admin
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="text"
            placeholder="Search coupons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCoupons()}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20 lg:flex-1"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
          </select>
          <button
            onClick={fetchCoupons}
            className="rounded-xl border border-black/15 bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85"
          >
            Search
          </button>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm font-medium text-black/55">Loading coupons...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-175">
                <thead className="border-b border-black/10 bg-black/3">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Valid Until</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-black/50">
                    No coupons found
                  </td>
                </tr>
              ) : (
                paginatedCoupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-black/5 transition hover:bg-black/2">
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-black">{coupon.code}</td>
                    <td className="px-6 py-4 text-sm capitalize text-black/70">{coupon.type}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-black">
                      {coupon.type === "percentage"
                        ? `${coupon.value}%`
                        : formatCurrency(coupon.value)}
                    </td>
                    <td className="px-6 py-4 text-sm text-black/75">
                      {coupon.usageCount} / {coupon.usageLimit || "∞"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                          coupon.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : coupon.status === "expired"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-black/10 bg-black/4 text-black/70"
                        }`}
                      >
                        {coupon.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-black/60">
                      {coupon.endDate
                        ? new Date(coupon.endDate).toLocaleDateString()
                        : "No expiry"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(coupon)}
                          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
            </div>
            <PaginationControls
              totalItems={coupons.length}
              currentPage={safePage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="coupons"
              className="border-t border-black/10 px-4 py-4"
            />
          </>
        )}
      </section>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-2xl">
            <div className="p-6">
              <h2 className="mb-4 text-2xl font-semibold text-black">
                {editingCoupon ? "Edit Coupon" : "Create Coupon"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    className="w-full rounded-xl border border-black/10 px-3 py-2 font-mono text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    placeholder="SUMMER2024"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Discount Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Value *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) =>
                        setFormData({ ...formData, value: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Min Purchase Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.minPurchase}
                      onChange={(e) =>
                        setFormData({ ...formData, minPurchase: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Max Discount (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.maxDiscount}
                      onChange={(e) =>
                        setFormData({ ...formData, maxDiscount: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Usage Limit (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usageLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, usageLimit: e.target.value })
                    }
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    placeholder="Leave empty for unlimited"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Start Date (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      End Date (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
                  >
                    {editingCoupon ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingCoupon(null);
                      resetForm();
                    }}
                    className="flex-1 rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black/75 transition hover:bg-black/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
