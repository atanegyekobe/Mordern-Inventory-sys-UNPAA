"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "@/lib/api";

interface NotificationContextValue {
  unreadMessages: number;
  unreadOrderNotifications: number;
  refreshNotifications: () => Promise<void>;
  markMessageAsRead: (messageId: string) => Promise<void>;
  markOrderNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllOrderNotificationsAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadMessages: 0,
  unreadOrderNotifications: 0,
  refreshNotifications: async () => {},
  markMessageAsRead: async () => {},
  markOrderNotificationAsRead: async () => {},
  markAllOrderNotificationsAsRead: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadOrderNotifications, setUnreadOrderNotifications] = useState(0);

  const refreshNotifications = useCallback(async () => {
    try {
      const token = window.localStorage.getItem("ellora_token");
      if (!token) {
        setUnreadMessages(0);
        setUnreadOrderNotifications(0);
        return;
      }

      const [messageResponse, orderResponse] = await Promise.all([
        api.get("/messages/unread/count"),
        api.get("/order-notifications/unread/count"),
      ]);

      const messageCount = messageResponse.data?.count || 0;
      const orderCount = orderResponse.data?.count || 0;

      setUnreadMessages(messageCount);
      setUnreadOrderNotifications(orderCount);
    } catch {
      setUnreadMessages(0);
      setUnreadOrderNotifications(0);
    }
  }, []);

  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      await api.post(`/messages/${messageId}/read`);
      // Refresh count after marking as read
      await refreshNotifications();
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  }, [refreshNotifications]);

  const markOrderNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.post(`/order-notifications/${notificationId}/read`);
      await refreshNotifications();
    } catch (error) {
      console.error("Failed to mark order notification as read:", error);
    }
  }, [refreshNotifications]);

  const markAllOrderNotificationsAsRead = useCallback(async () => {
    try {
      await api.post("/order-notifications/read-all");
      await refreshNotifications();
    } catch (error) {
      console.error("Failed to mark order notifications as read:", error);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    const load = async () => {
      await refreshNotifications();
    };
    load();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);

    const handleFocus = () => {
      refreshNotifications();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshNotifications();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        unreadMessages,
        unreadOrderNotifications,
        refreshNotifications,
        markMessageAsRead,
        markOrderNotificationAsRead,
        markAllOrderNotificationsAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
