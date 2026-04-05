"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import { useNotifications } from "@/lib/notification-alert-context";
import NotificationBadge from "@/components/NotificationBadge";
import type { OrderNotification } from "@/lib/types";

export default function OrderNotificationMenu() {
  const { unreadOrderNotifications, markOrderNotificationAsRead, markAllOrderNotificationsAsRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const response = await api.get("/order-notifications");
        setNotifications(response.data || []);
      } catch {
        setNotifications([]);
      }
    };

    load();
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleMarkRead = async (notificationId: string) => {
    await markOrderNotificationAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((note) =>
        note.id === notificationId ? { ...note, readAt: new Date().toISOString() } : note
      )
    );
  };

  const handleMarkAll = async () => {
    await markAllOrderNotificationsAsRead();
    setNotifications((prev) =>
      prev.map((note) => ({ ...note, readAt: new Date().toISOString() }))
    );
  };

  const unreadLocal = notifications.filter((note) => !note.readAt).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-full border border-black/10 p-2 transition hover:border-black/20"
        aria-label="Order notifications"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7h-4m4 0v4m0-4l-6 6m-2 4H4a1 1 0 01-1-1V8a1 1 0 011-1h10"
          />
        </svg>
        <NotificationBadge count={unreadOrderNotifications} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Order updates</p>
              <p className="text-xs text-black/50">Latest status notifications</p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-semibold text-black/70 hover:text-black"
              >
                Mark all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-black/50">
              No order updates yet.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.slice(0, 8).map((note) => (
                <div
                  key={note.id}
                  className={`border-b border-black/5 px-4 py-3 ${
                    !note.readAt ? "bg-black/5" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-black">
                        {note.subject}
                      </p>
                      <p className="mt-1 text-xs text-black/60">
                        {note.content}
                      </p>
                      <p className="mt-2 text-xs text-black/40">
                        {formatDateShort(note.createdAt)}
                      </p>
                    </div>
                    {!note.readAt && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(note.id)}
                        className="text-xs font-semibold text-black/60 hover:text-black"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {unreadLocal > 0 && (
            <div className="border-t border-black/5 px-4 py-2 text-xs text-black/50">
              {unreadLocal} unread update{unreadLocal === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
