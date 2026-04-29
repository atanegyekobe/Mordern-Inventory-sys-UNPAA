"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import PaginationControls from "@/components/PaginationControls";
import { useToast } from "@/hooks/useToast";
import { useNotifications } from "@/lib/notification-alert-context";

const PAGE_SIZE = 10;

interface Message {
  id: string;
  subject: string;
  content: string;
  status: string;
  priority: string;
  createdAt: string;
  readAt: string | null;
  User: {
    id: string;
    name: string;
    email: string;
  };
  MessageReplies: Array<{
    id: string;
    content: string;
    isAdminReply: boolean;
    createdAt: string;
    User: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
}

export default function MessagesPage() {
  const router = useRouter();
  const toast = useToast();
  const { markMessageAsRead } = useNotifications();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [newMessageSubject, setNewMessageSubject] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");
  const [newMessagePriority, setNewMessagePriority] = useState("medium");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const getApiErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || error === null || !("response" in error)) {
      return undefined;
    }

    const response = (error as { response?: { status?: unknown } }).response;
    return typeof response?.status === "number" ? response.status : undefined;
  };

  const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (typeof error !== "object" || error === null || !("response" in error)) {
      return fallback;
    }

    const data =
      (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response
        ?.data;

    if (typeof data?.error === "string") {
      return data.error;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    return fallback;
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterPriority]);

  useEffect(() => {
    if (showNewMessageModal) {
      fetchCustomers();
    }
  }, [showNewMessageModal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterPriority]);

  const fetchCustomers = async () => {
    try {
      const response = await api.get("/customers");
      setAllCustomers(response.data || []);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterPriority) params.append("priority", filterPriority);

      const response = await api.get(`/messages?${params.toString()}`);
      setMessages(response.data);

      // Update selected message if it's in the list
      if (selectedMessage) {
        const updated = response.data.find((m: Message) => m.id === selectedMessage.id);
        if (updated) setSelectedMessage(updated);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch messages:", err);
      if (getApiErrorStatus(err) === 401) {
        setError("Please login as admin");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError("Failed to load messages");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMessage = async (message: Message) => {
    setSelectedMessage(message);
    setReplyContent("");
    // Mark message as read when opened
    await markMessageAsRead(message.id);
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyContent.trim()) return;

    try {
      setSendingReply(true);
      await api.post(`/messages/${selectedMessage.id}/replies`, {
        content: replyContent,
      });

      setReplyContent("");
      toast.success("Reply sent!");
      await fetchMessages();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to send reply"));
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (messageId: string, status: string) => {
    try {
      await api.put(`/messages/${messageId}/status`, { status });
      toast.success("Status updated!");
      await fetchMessages();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update status"));
    }
  };

  const handleUpdatePriority = async (messageId: string, priority: string) => {
    try {
      await api.put(`/messages/${messageId}/status`, { priority });
      toast.success("Priority updated!");
      await fetchMessages();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update priority"));
    }
  };

  const handleSendNewMessage = async () => {
    if (!selectedCustomer.trim() || !newMessageSubject.trim() || !newMessageContent.trim()) {
      toast.warning("Please select a customer, add a subject, and write content");
      return;
    }

    try {
      setSendingMessage(true);
      await api.post("/messages/admin/send", {
        userId: selectedCustomer,
        subject: newMessageSubject,
        content: newMessageContent,
        priority: newMessagePriority,
      });

      setShowNewMessageModal(false);
      setSelectedCustomer("");
      setNewMessageSubject("");
      setNewMessageContent("");
      setNewMessagePriority("medium");
      toast.success("Message sent successfully!");
      await fetchMessages();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to send message"));
    } finally {
      setSendingMessage(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(messages.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMessages = messages.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="h-[calc(100vh-80px)] space-y-6 p-4 md:p-6">
      <div className="rounded-3xl border border-black/10 bg-linear-to-r from-sky-50 via-white to-amber-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-black md:text-4xl">Customer Messages</h1>
            <p className="mt-2 text-sm text-black/65">Monitor conversations, set priority/status, and respond from a unified inbox.</p>
          </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowNewMessageModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            New Message
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
              className="w-4 h-4"
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100%-60px)]">
        {/* Messages List */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          {/* Filters */}
          <div className="space-y-2 border-b border-black/10 p-4 bg-black/2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="replied">Replied</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-black/55">Loading...</div>
            ) : error ? (
              <div className="p-4">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="p-4 text-center text-black/55">No messages found</div>
            ) : (
              paginatedMessages.map((message) => (
                <div
                  key={message.id}
                  className={`relative border-b border-black/10 p-4 transition hover:bg-black/2 ${
                    selectedMessage?.id === message.id ? "bg-sky-50" : ""
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!message.readAt && (
                    <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-600" />
                  )}
                  <div 
                    onClick={() => handleSelectMessage(message)}
                    className="cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className={`text-sm truncate flex-1 ${!message.readAt ? "font-bold" : "font-semibold"}`}>
                        {message.subject}
                      </p>
                      <span
                        className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          message.priority === "high"
                            ? "bg-red-100 text-red-800"
                            : message.priority === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {message.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-black/60">
                        {message.User.name}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          message.status === "open"
                            ? "bg-yellow-100 text-yellow-800"
                            : message.status === "replied"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-black/4 text-black/70"
                        }`}
                      >
                        {message.status}
                      </span>
                      <span className="text-xs text-black/55">
                        {new Date(message.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin`);
                    }}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black/70 transition hover:bg-black/5"
                    title="View customer profile"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                      />
                    </svg>
                    View Customer Profile
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-black/10 p-4">
            <PaginationControls
              totalItems={messages.length}
              currentPage={safePage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="messages"
            />
          </div>
        </div>

        {/* Message Detail */}
        <div className="md:col-span-2 flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          {!selectedMessage ? (
            <div className="flex flex-1 items-center justify-center text-black/55">
              Select a message to view details
            </div>
          ) : (
            <>
              {/* Message Header */}
              <div className="border-b border-black/10 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">
                      {selectedMessage.subject}
                    </h2>
                    <div className="flex items-center gap-3">
                      <p className="text-black/60">
                        From: {selectedMessage.User.name} ({selectedMessage.User.email})
                      </p>
                      <button
                        onClick={() => router.push(`/admin`)}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                        title="View customer profile"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-3.5 h-3.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                          />
                        </svg>
                        View Profile
                      </button>
                    </div>
                    <p className="text-sm text-black/55">
                      {new Date(selectedMessage.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedMessage.priority}
                      onChange={(e) =>
                        handleUpdatePriority(selectedMessage.id, e.target.value)
                      }
                      className="rounded-xl border border-black/10 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <select
                      value={selectedMessage.status}
                      onChange={(e) =>
                        handleUpdateStatus(selectedMessage.id, e.target.value)
                      }
                      className="rounded-xl border border-black/10 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    >
                      <option value="open">Open</option>
                      <option value="replied">Replied</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                {/* Original Message */}
                <div className="rounded-xl border border-black/10 bg-black/2 p-4">
                  <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
                </div>
              </div>

              {/* Replies */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedMessage.MessageReplies.length === 0 ? (
                  <p className="py-8 text-center text-black/55">No replies yet</p>
                ) : (
                  selectedMessage.MessageReplies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`p-4 rounded-lg ${
                        reply.isAdminReply
                          ? "bg-blue-50 ml-8"
                          : "bg-black/2 mr-8"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-sm">
                          {reply.User.name}
                          {reply.isAdminReply && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs">
                              Admin
                            </span>
                          )}
                        </p>
                        <span className="text-xs text-black/55">
                          {new Date(reply.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Form */}
              <div className="border-t border-black/10 p-6">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type your reply..."
                  className="mb-3 w-full resize-none rounded-xl border border-black/10 px-4 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                  rows={3}
                />
                <button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyContent.trim()}
                  className="w-full rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-50"
                >
                  {sendingReply ? "Sending..." : "Send Reply"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Send Message to Customer</h2>
                <button
                  onClick={() => setShowNewMessageModal(false)}
                  className="text-black/50 hover:text-black/75"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Customer *
                  </label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="">-- Choose a customer --</option>
                    {allCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={newMessageSubject}
                    onChange={(e) => setNewMessageSubject(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    placeholder="e.g., Order Update, Special Offer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Message Content *
                  </label>
                  <textarea
                    value={newMessageContent}
                    onChange={(e) => setNewMessageContent(e.target.value)}
                    className="min-h-32 w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                    placeholder="Write your message here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Priority
                  </label>
                  <select
                    value={newMessagePriority}
                    onChange={(e) => setNewMessagePriority(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSendNewMessage}
                    disabled={sendingMessage}
                    className="flex-1 rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-50"
                  >
                    {sendingMessage ? "Sending..." : "Send Message"}
                  </button>
                  <button
                    onClick={() => setShowNewMessageModal(false)}
                    className="flex-1 rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-black/75 transition hover:bg-black/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
