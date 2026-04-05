"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PaginationControls from "@/components/PaginationControls";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

const PAGE_SIZE = 10;

interface Customer {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  stats: {
    orderCount: number;
    totalSpent: string | number;
    messageCount: number;
    lastOrderDate: string | null;
  };
}

export default function CustomersPage() {
  const router = useRouter();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("customer");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filterRole) params.append("role", filterRole);
      if (searchTerm) params.append("search", searchTerm);

      const response = await api.get(`/customers?${params.toString()}`);
      setCustomers(response.data);
    } catch (err: unknown) {
      const statusCode = (err as { response?: { status?: number } })?.response
        ?.status;
      console.error("Failed to fetch customers:", err);
      if (statusCode === 401) {
        setError("Please login as admin");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError("Failed to load customers");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchCustomers();
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      await api.delete(`/customers/${customerId}`);
      toast.success("Customer deleted successfully!");
      fetchCustomers();
    } catch (error: unknown) {
      const responseError = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(responseError || "Failed to delete customer");
    }
  };

  const viewCustomerDetails = (customerId: string) => {
    router.push(`/admin/customers/${customerId}`);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole]);

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCustomers = customers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );


  const activeCustomers = customers.filter((c) => c.stats.orderCount > 0).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-3xl border border-black/10 bg-linear-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Customer Relationship</p>
            <h1 className="mt-2 text-3xl font-semibold text-black md:text-4xl">Customers</h1>
            <p className="mt-2 text-sm text-black/65">Track customer growth, spending trends, and support engagement in one view.</p>
          </div>
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
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20 lg:flex-1"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black/20"
          >
            <option value="customer">Customer</option>
          </select>
          <button
            onClick={handleSearch}
            className="rounded-xl border border-black/15 bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85"
          >
            Search
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Total Customers</p>
          <p className="mt-2 text-3xl font-semibold text-black">{customers.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/70">Active (With Orders)</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{activeCustomers}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm font-medium text-black/55">Loading customers...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-215">
                <thead className="border-b border-black/10 bg-black/3">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Total Spent</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Messages</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Last Order</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Joined</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-black/50">
                        No customers found
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((customer) => (
                      <tr key={customer.id} className="border-b border-black/5 transition hover:bg-black/2">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-black">{customer.name}</p>
                            <p className="text-sm text-black/55">{customer.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full border border-black/10 bg-black/4 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
                            Customer
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-black/80">{customer.stats.orderCount}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-emerald-700">
                          {formatCurrency(customer.stats.totalSpent)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-black/75">{customer.stats.messageCount}</td>
                        <td className="px-6 py-4 text-sm text-black/60">
                          {customer.stats.lastOrderDate
                            ? new Date(customer.stats.lastOrderDate).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="px-6 py-4 text-sm text-black/60">
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => viewCustomerDetails(customer.id)}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id)}
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
              totalItems={customers.length}
              currentPage={safePage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="customers"
              className="border-t border-black/10 px-4 py-4"
            />
          </>
        )}
      </section>
    </div>
  );
}
