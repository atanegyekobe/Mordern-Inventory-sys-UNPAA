"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-alert-context";
import BackButton from "@/components/BackButton";
import NavBar from "@/components/NavBar";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";

const PAGE_SIZE = 10;

interface Message {
  id: string;
  subject: string;
  content: string;
  status: string;
  priority: string;
  createdAt: string;
  readAt: string | null;
  MessageReplies: Array<{
    id: string;
    content: string;
    isAdminReply: boolean;
    createdAt: string;
    User: {
      id: string;
      name: string;
      role: string;
    };
  }>;
}

export default function CustomerSupportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { markMessageAsRead } = useNotifications();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "closed">("all");

  useEffect(() => {
    if (!user) {
      router.push("/login?redirect=/account/support");
      return;
    }
    fetchMessages();
  }, [user, router]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/messages");
      setMessages(response.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMessage = async (message: Message) => {
    setSelectedMessage(message);
    // Mark message as read when opened
    await markMessageAsRead(message.id);
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim()) return;

    setSendingReply(true);
    try {
      await api.post(`/messages/${messageId}/replies`, {
        content: replyText,
      });
      setReplyText("");
      await fetchMessages();
      
      // Update selected message with new reply
      const updatedMessage = messages.find((m) => m.id === messageId);
      if (updatedMessage) {
        const response = await api.get(`/messages/${messageId}`);
        setSelectedMessage(response.data);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const filteredMessages = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return messages.filter((message) => {
      const statusMatches = statusFilter === "all" || message.status === statusFilter;
      const queryMatches =
        query.length === 0 ||
        message.subject.toLowerCase().includes(query) ||
        message.content.toLowerCase().includes(query);

      return statusMatches && queryMatches;
    });
  }, [messages, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMessages = filteredMessages.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const unreadCount = messages.filter((message) => !message.readAt).length;
  const openCount = messages.filter((message) => message.status !== "closed").length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-amber-50/50 via-white to-sky-50/40">
        <NavBar />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-black/60">Loading your messages...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-amber-50/50 via-white to-sky-50/40">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="mb-6 rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-semibold text-black">My Support Messages</h1>
              <p className="text-sm text-black/65">
                View and manage your support conversations
              </p>
            </div>
            <button
              onClick={() => router.push("/support")}
              className="rounded-xl bg-linear-to-r from-rose-500 to-orange-500 px-6 py-2 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600"
            >
              New Message
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-black/2 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Total</p>
              <p className="mt-1 text-2xl font-semibold text-black">{messages.length}</p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700/70">Open Threads</p>
              <p className="mt-1 text-2xl font-semibold text-cyan-700">{openCount}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700/75">Unread</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{unreadCount}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
              <div className="border-b border-black/10 p-4 bg-black/2">
                <h2 className="font-semibold text-lg">All Messages ({filteredMessages.length})</h2>
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search subject or message"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 outline-none focus:ring-2 focus:ring-black/20"
                  />
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "all", label: "All" },
                      { key: "open", label: "Open" },
                      { key: "in_progress", label: "In progress" },
                      { key: "closed", label: "Closed" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setStatusFilter(option.key as "all" | "open" | "in_progress" | "closed")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          statusFilter === option.key
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-black/10 bg-white text-black/65 hover:border-black/25"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="divide-y max-h-150 overflow-y-auto">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-black/55">
                    <p className="mb-2">No messages match your filters</p>
                    <p className="mb-4 text-xs text-black/45">Try changing search or status filters.</p>
                    <button
                      onClick={() => router.push("/support")}
                      className="font-semibold text-sky-700 hover:underline"
                    >
                      Send your first message
                    </button>
                  </div>
                ) : (
                  paginatedMessages.map((message, index) => (
                    <motion.button
                      key={message.id}
                      onClick={() => handleSelectMessage(message)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.03 }}
                      whileHover={{ y: -1 }}
                      className={`group relative w-full border-l-4 border-transparent p-4 text-left transition hover:bg-linear-to-r hover:from-rose-50 hover:to-orange-50/40 hover:shadow-[inset_0_0_0_1px_rgba(251,113,133,0.18)] ${
                        selectedMessage?.id === message.id ? "border-sky-600 bg-sky-50" : ""
                      } ${!message.readAt ? "font-semibold" : ""}`}
                    >
                      {/* Unread indicator dot */}
                      {!message.readAt && (
                        <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-600" />
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <p className={`text-sm truncate flex-1 ${!message.readAt ? "font-bold" : "font-semibold"}`}>
                          {message.subject}
                        </p>
                        <span
                          className={`ml-2 px-2 py-0.5 rounded text-xs shrink-0 ${
                            message.priority === "high"
                              ? "bg-red-100 text-red-800"
                              : message.priority === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-black/4 text-black/70"
                          }`}
                        >
                          {message.priority}
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-black/55">
                        {new Date(message.createdAt).toLocaleDateString()}
                      </p>
                      <p className="mb-2 text-xs text-black/45 transition group-hover:text-black/60">
                        {message.content.length > 90
                          ? `${message.content.slice(0, 90)}...`
                          : message.content}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            message.status === "closed"
                              ? "bg-gray-100 text-gray-700"
                              : message.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {message.status.replace("_", " ")}
                        </span>
                        {message.MessageReplies.length > 0 && (
                          <span className="text-xs text-black/55">
                            {message.MessageReplies.length} {message.MessageReplies.length === 1 ? "reply" : "replies"}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
              <div className="border-t border-black/10 p-4">
                <PaginationControls
                  totalItems={filteredMessages.length}
                  currentPage={safePage}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  itemLabel="messages"
                />
              </div>
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedMessage ? (
                <motion.div
                  key={selectedMessage.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24 }}
                  className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
                >
                  <div className="border-b border-black/10 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-2xl font-bold mb-2">
                          {selectedMessage.subject}
                        </h2>
                        <p className="text-sm text-black/55">
                          Created {new Date(selectedMessage.createdAt).toLocaleDateString()} at{" "}
                          {new Date(selectedMessage.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span
                          className={`px-3 py-1 rounded text-sm ${
                            selectedMessage.priority === "high"
                              ? "bg-red-100 text-red-800"
                              : selectedMessage.priority === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-black/4 text-black/70"
                          }`}
                        >
                          {selectedMessage.priority}
                        </span>
                        <span
                          className={`px-3 py-1 rounded text-sm ${
                            selectedMessage.status === "closed"
                              ? "bg-gray-100 text-gray-700"
                              : selectedMessage.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {selectedMessage.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-black/2 p-4">
                      <p className="whitespace-pre-wrap text-black/75">
                        {selectedMessage.content}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black/60">
                        Message ID: {selectedMessage.id.slice(0, 8)}
                      </span>
                      {!selectedMessage.readAt && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Unread until opened
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Replies */}
                  <div className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Replies</h3>
                    <div className="space-y-4 mb-6">
                      {selectedMessage.MessageReplies.length === 0 ? (
                        <p className="py-4 text-center text-black/55">
                          No replies yet. We&apos;ll respond as soon as possible!
                        </p>
                      ) : (
                        selectedMessage.MessageReplies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`p-4 rounded-lg ${
                              reply.isAdminReply
                                ? "bg-blue-50 border border-blue-200"
                                  : "bg-black/2"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-semibold text-sm">
                                {reply.User.name}
                                {reply.isAdminReply && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded text-xs">
                                    Support Team
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-black/55">
                                {new Date(reply.createdAt).toLocaleDateString()} at{" "}
                                {new Date(reply.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <p className="whitespace-pre-wrap text-black/75">
                              {reply.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reply Form */}
                    {selectedMessage.status !== "closed" && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3">Send a reply</h4>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply here..."
                          rows={4}
                          className="mb-3 w-full resize-none rounded-xl border border-black/10 px-4 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                        />
                        <button
                          onClick={() => handleSendReply(selectedMessage.id)}
                          disabled={sendingReply || !replyText.trim()}
                          className="rounded-xl bg-linear-to-r from-rose-500 to-orange-500 px-6 py-2 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {sendingReply ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                    )}

                    {selectedMessage.status === "closed" && (
                      <div className="rounded-xl border border-black/10 bg-black/2 p-4 text-center">
                        <p className="text-black/60">
                          This conversation has been closed. If you need further assistance,{" "}
                          <button
                            onClick={() => router.push("/support")}
                            className="font-semibold text-sky-700 hover:underline"
                          >
                            create a new message
                          </button>
                          .
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty-thread"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-black/10 bg-white p-12 text-center shadow-sm"
                >
                  <svg
                    className="mx-auto mb-4 h-16 w-16 text-black/25"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="mb-4 text-lg text-black/55">
                    Select a message to view the conversation
                  </p>
                  <button
                    onClick={() => router.push("/support")}
                    className="font-semibold text-sky-700 hover:underline"
                  >
                    Or create a new message
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
