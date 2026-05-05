"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { AdminRoute } from "@/components/RouteGuards";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/useToast";
import BackButton from "@/components/BackButton";

type StockRequest = {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
  } | null;
  quantity: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requester: {
    id: string;
    name: string;
    email: string;
  } | null;
  approver: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  approvedAt: string | null;
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || "Something went wrong.";
  }
  return "Something went wrong.";
};

export default function StockRequestsPage() {
  const toast = useToast();
  const { user, shops, activeShopId } = useAuth();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = filter !== "all" ? { status: filter } : {};
      const response = await api.get("/stock-requests", { params });
      setRequests(response.data.requests ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [filter]);

  const approveRequest = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      await api.patch(`/stock-requests/${requestId}/approve`);
      toast.success("Stock request approved!");
      await loadRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      await api.patch(`/stock-requests/${requestId}/reject`, {
        rejectionReason: rejectReason,
      });
      toast.success("Stock request rejected.");
      setSelectedRequest(null);
      setRejectReason("");
      await loadRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "rejected":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const activeShop = activeShopId
    ? shops.find((shop) => shop.id === activeShopId) || null
    : shops.length === 1
    ? shops[0]
    : null;
  const isStaff = Boolean(user?.role !== "admin" && activeShop?.role === "STAFF");

  return (
    <AdminRoute>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,transparent_26%),radial-gradient(circle_at_top_right,#cffafe_0%,transparent_24%),linear-gradient(180deg,#fafaf9_0%,#f8fafc_100%)]">
        <NavBar />
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <BackButton label="Back to admin" className="mb-4" />
                <h1 className="text-3xl font-bold text-black">Stock Requests</h1>
                <p className="mt-2 text-sm text-black/60">
                  Review and approve or reject staff stock requests
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                {isStaff && (
                  <Link
                    href="/admin/stock-requests/request"
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/90"
                  >
                    Request Stock
                  </Link>
                )}
                {pendingCount > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                      Pending Requests
                    </p>
                    <p className="mt-1 text-2xl font-bold text-amber-900">{pendingCount}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-black/10">
              {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-4 py-3 text-sm font-semibold uppercase tracking-wider transition ${
                    filter === tab
                      ? "border-b-2 border-sky-500 text-sky-700"
                      : "text-black/50 hover:text-black/70"
                  }`}
                >
                  {tab === "all" ? "All" : tab}
                </button>
              ))}
            </div>

            {/* Requests Table */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl border border-black/10 bg-black/2 animate-pulse"
                  />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-8 text-center">
                <p className="text-black/60">No stock requests found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-semibold text-black">
                              {request.product?.name || "Product"}
                            </p>
                            <p className="mt-1 text-xs text-black/55">
                              SKU: {request.product?.sku || "N/A"}
                            </p>
                          </div>
                          <span
                            className={`ml-auto shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-black/45">
                              Requested Qty
                            </p>
                            <p className="mt-1 text-lg font-semibold text-black">
                              {request.quantity}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-widest text-black/45">
                              Current Stock
                            </p>
                            <p className="mt-1 text-lg font-semibold text-black">
                              {request.product?.currentStock ?? 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-widest text-black/45">
                              Requested By
                            </p>
                            <p className="mt-1 text-sm font-semibold text-black">
                              {request.requester?.name || "Unknown"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-widest text-black/45">
                              Date
                            </p>
                            <p className="mt-1 text-sm font-semibold text-black">
                              {new Intl.DateTimeFormat("en-US", {
                                dateStyle: "short",
                              }).format(new Date(request.createdAt))}
                            </p>
                          </div>
                        </div>

                        {request.reason && (
                          <div className="mt-3 rounded-lg bg-black/2 p-3">
                            <p className="text-xs uppercase tracking-widest text-black/45">
                              Reason
                            </p>
                            <p className="mt-1 text-sm text-black">{request.reason}</p>
                          </div>
                        )}
                      </div>

                      {request.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveRequest(request.id)}
                            disabled={processingId === request.id}
                            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setSelectedRequest(request)}
                            disabled={processingId === request.id}
                            className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {request.status === "approved" && request.approver && (
                        <div className="text-right text-xs text-black/55">
                          <p>Approved by {request.approver.name}</p>
                          <p>
                            {new Intl.DateTimeFormat("en-US", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(request.approvedAt || ""))}
                          </p>
                        </div>
                      )}

                      {request.status === "rejected" && request.approver && (
                        <div className="text-right text-xs text-red-600">
                          <p>Rejected by {request.approver.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reject Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-black">Reject Request</h2>
              <p className="mt-2 text-sm text-black/60">
                Are you sure you want to reject this stock request for{" "}
                <span className="font-semibold">{selectedRequest.product?.name}</span>?
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional rejection reason..."
                className="mt-4 w-full rounded-lg border border-black/10 bg-black/2 p-3 text-sm outline-none transition focus:border-black/30 focus:bg-white"
                rows={3}
              />

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setRejectReason("");
                  }}
                  className="flex-1 rounded-lg border border-black/10 bg-white px-4 py-2 font-semibold text-black transition hover:bg-black/3"
                >
                  Cancel
                </button>
                <button
                  onClick={() => rejectRequest(selectedRequest.id)}
                  disabled={processingId === selectedRequest.id}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRoute>
  );
}
