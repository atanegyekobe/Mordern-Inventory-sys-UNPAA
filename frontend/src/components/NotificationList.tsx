"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatDistanceToNow } from "@/lib/format";

interface NotificationItem {
  id: string;
  subject: string;
  content: string;
  status: string;
  priority: string;
  createdAt: string;
  readAt: string | null;
  User?: {
    name: string;
  };
}

interface NotificationListProps {
  limit?: number;
  showViewAll?: boolean;
}

export default function NotificationList({
  limit = 5,
  showViewAll = true,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get("/messages");
        const messages = response.data || [];
        
        // Filter unread messages (readAt is null)
        const unread = messages
          .filter((msg: NotificationItem) => !msg.readAt)
          .slice(0, limit);
          
        setNotifications(unread);
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [limit]);

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-black/60">
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/5">
          <svg
            className="h-6 w-6 text-black/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-black/80">All caught up!</p>
        <p className="mt-1 text-xs text-black/60">No new notifications</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="divide-y divide-black/5">
      {notifications.map((notification) => (
        <Link
          key={notification.id}
          href={`/account/support`}
          className="block p-4 transition hover:bg-black/5"
        >
          <div className="flex items-start gap-3">
            {/* Unread indicator dot */}
            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-black">
                  {notification.subject}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(
                    notification.priority
                  )}`}
                >
                  {notification.priority}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-black/60">
                {notification.content}
              </p>
              <p className="mt-2 text-xs text-black/40">
                {formatDistanceToNow(notification.createdAt)}
              </p>
            </div>
          </div>
        </Link>
      ))}
      {showViewAll && notifications.length > 0 && (
        <Link
          href="/account/support"
          className="block p-3 text-center text-sm font-medium text-black/70 transition hover:bg-black/5 hover:text-black"
        >
          View all messages →
        </Link>
      )}
    </div>
  );
}
