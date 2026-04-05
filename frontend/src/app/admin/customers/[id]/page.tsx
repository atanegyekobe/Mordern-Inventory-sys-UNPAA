"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import BackButton from "@/components/BackButton";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toAssetUrl } from "@/lib/assets";

const PAGE_SIZE = 10;

const formatOrderStatus = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

interface CustomerDetail {
  customer: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  };
  orders: Array<{
    id: string;
    total: string | number;
    status: string;
    createdAt: string;
    OrderItems: Array<{
      quantity: number;
      unitPrice: string | number;
      Product: {
        id: string;
        name: string;
        imageUrl: string;
      };
    }>;
  }>;
  messages: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
  stats: {
    orderCount: number;
    totalSpent: string | number;
    avgOrderValue: string | number;
    messageCount: number;
  };
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'messages' | 'account'>('profile');

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/customers/${customerId}`);
      setCustomer(response.data);
    } catch (err: unknown) {
      console.error("Failed to fetch customer details:", err);
      const statusCode = (err as { response?: { status?: number } })?.response
        ?.status;
      if (statusCode === 401) {
        setError("Please login as admin");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError("Failed to load customer details");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    setOrdersPage(1);
    setMessagesPage(1);
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-black/60">Loading customer details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <p className="text-red-600">Customer not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Go Back
        </button>
      </div>
    );
  }

  const totalOrderPages = Math.max(1, Math.ceil(customer.orders.length / PAGE_SIZE));
  const safeOrdersPage = Math.min(ordersPage, totalOrderPages);
  const paginatedOrders = customer.orders.slice(
    (safeOrdersPage - 1) * PAGE_SIZE,
    safeOrdersPage * PAGE_SIZE
  );

  const totalMessagePages = Math.max(1, Math.ceil(customer.messages.length / PAGE_SIZE));
  const safeMessagesPage = Math.min(messagesPage, totalMessagePages);
  const paginatedMessages = customer.messages.slice(
    (safeMessagesPage - 1) * PAGE_SIZE,
    safeMessagesPage * PAGE_SIZE
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="rounded-3xl border border-black/10 bg-linear-to-r from-sky-50 via-white to-amber-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Customer Profile</p>
              <h1 className="mt-1 text-3xl font-semibold text-black md:text-4xl">{customer.customer.name}</h1>
              <p className="mt-1 text-sm text-black/65">{customer.customer.email}</p>
            </div>
          </div>
          <span
            className={`inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
              customer.customer.role === "admin"
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
            }`}
          >
            {customer.customer.role}
          </span>
        </div>
        <div className="mt-6 flex gap-2 border-b border-black/10">
          <button className={`px-4 py-2 font-semibold ${activeTab === 'profile' ? 'border-b-2 border-black text-black' : 'text-black/50'}`} onClick={() => setActiveTab('profile')}>Profile</button>
          <button className={`px-4 py-2 font-semibold ${activeTab === 'orders' ? 'border-b-2 border-black text-black' : 'text-black/50'}`} onClick={() => setActiveTab('orders')}>Orders</button>
          <button className={`px-4 py-2 font-semibold ${activeTab === 'messages' ? 'border-b-2 border-black text-black' : 'text-black/50'}`} onClick={() => setActiveTab('messages')}>Messages</button>
          <button className={`px-4 py-2 font-semibold ${activeTab === 'account' ? 'border-b-2 border-black text-black' : 'text-black/50'}`} onClick={() => setActiveTab('account')}>Account</button>
        </div>
      </section>

      {activeTab === 'profile' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Total Orders</p>
            <p className="mt-2 text-3xl font-semibold text-black">{customer.stats.orderCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/70">Total Spent</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">{formatCurrency(customer.stats.totalSpent)}</p>
          </div>
          <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700/70">Avg Order Value</p>
            <p className="mt-2 text-3xl font-semibold text-sky-700">{formatCurrency(customer.stats.avgOrderValue)}</p>
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700/70">Messages</p>
            <p className="mt-2 text-3xl font-semibold text-amber-700">{customer.stats.messageCount}</p>
          </div>
        </section>
      )}

      {activeTab === 'orders' && (
        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-black md:text-2xl">Order History</h2>
          {customer.orders.length === 0 ? (
            <p className="py-10 text-center text-sm text-black/50">No orders yet</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border border-black/10 rounded-xl">
                <thead className="bg-black/3">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Order #</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Total</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-black/60">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="border-b border-black/10 hover:bg-black/2">
                      <td className="px-4 py-2 font-semibold text-black">{order.id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-black/70">{new Date(order.createdAt).toLocaleDateString()}<br /><span className="text-xs text-black/40">{new Date(order.createdAt).toLocaleTimeString()}</span></td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          order.status === "fulfilled"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : order.status === "delivery_pickup"
                            ? "border-orange-200 bg-orange-50 text-orange-700"
                            : order.status === "processing"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : order.status === "paid"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : order.status === "pending"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-black/10 bg-black/4 text-black/70"
                        }`}>
                          {formatOrderStatus(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-semibold text-black">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-2">
                        <ul className="space-y-1">
                          {order.OrderItems.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              {item.Product?.imageUrl && (
                                <Image
                                  src={toAssetUrl(item.Product.imageUrl)}
                                  alt={item.Product?.name ?? "Product"}
                                  width={24}
                                  height={24}
                                  unoptimized
                                  className="h-6 w-6 rounded object-cover"
                                />
                              )}
                              <span className="text-black/80 text-sm">{item.Product?.name ?? "Product"}</span>
                              <span className="text-black/50 text-xs">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls
                totalItems={customer.orders.length}
                currentPage={safeOrdersPage}
                pageSize={PAGE_SIZE}
                onPageChange={setOrdersPage}
                itemLabel="orders"
                className="border-t border-black/10 px-4 py-4"
              />
            </div>
          )}
        </section>
      )}

      {activeTab === 'messages' && (
        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-black md:text-2xl">Recent Messages</h2>
          {customer.messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-black/50">No messages</p>
          ) : (
            <div className="mt-4 space-y-3">
              {paginatedMessages.map((message) => (
                <div
                  key={message.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/10 bg-black/2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-black">{message.subject}</p>
                    <p className="text-sm text-black/55">{new Date(message.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                        message.priority === "high"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : message.priority === "medium"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-black/10 bg-black/4 text-black/70"
                      }`}
                    >
                      {message.priority}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                        message.status === "open"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : message.status === "replied"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-black/10 bg-black/4 text-black/70"
                      }`}
                    >
                      {message.status}
                    </span>
                  </div>
                </div>
              ))}
              <PaginationControls
                totalItems={customer.messages.length}
                currentPage={safeMessagesPage}
                pageSize={PAGE_SIZE}
                onPageChange={setMessagesPage}
                itemLabel="messages"
              />
            </div>
          )}
        </section>
      )}

      {activeTab === 'account' && (
        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-black md:text-2xl">Customer Information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-black/2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Member Since</p>
              <p className="mt-1 font-semibold text-black">
                {new Date(customer.customer.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Account Type</p>
              <p className="mt-1 font-semibold capitalize text-black">{customer.customer.role}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
