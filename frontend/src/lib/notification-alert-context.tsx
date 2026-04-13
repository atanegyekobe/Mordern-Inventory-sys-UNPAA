"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "@/lib/api";

interface NotificationContextValue {
  unreadMessages: number;
  refreshNotifications: () => Promise<void>;
  markMessageAsRead: (messageId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadMessages: 0,
  refreshNotifications: async () => {},
  markMessageAsRead: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshNotifications = useCallback(async () => {
    try {
      const token = window.localStorage.getItem("ellora_token");
      if (!token) {
        setUnreadMessages(0);
        return;
      }

      const messageResponse = await api.get("/messages/unread/count");

      const messageCount = messageResponse.data?.count || 0;

      setUnreadMessages(messageCount);
    } catch {
      setUnreadMessages(0);
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
        refreshNotifications,
        markMessageAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
