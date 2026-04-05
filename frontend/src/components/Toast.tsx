"use client";

import { useNotification, NotificationType } from "@/lib/notification-context";
import { motion, AnimatePresence } from "framer-motion";

const typeStyles: Record<NotificationType, { bg: string; text: string; icon: string }> = {
  success: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    icon: "✓",
  },
  error: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    icon: "✕",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    icon: "ℹ",
  },
  warning: {
    bg: "bg-yellow-50 border-yellow-200",
    text: "text-yellow-800",
    icon: "⚠",
  },
};

const iconColors: Record<NotificationType, string> = {
  success: "bg-green-100 text-green-600",
  error: "bg-red-100 text-red-600",
  info: "bg-blue-100 text-blue-600",
  warning: "bg-yellow-100 text-yellow-600",
};

export function Toast() {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notification) => {
          const styles = typeStyles[notification.type];
          const iconBg = iconColors[notification.type];

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -20, x: 100 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -20, x: 100 }}
              transition={{ duration: 0.3 }}
              className="mb-3 pointer-events-auto"
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${styles.bg} ${styles.text} shadow-lg`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${iconBg}`}>
                  {styles.icon}
                </div>
                <p className="text-sm font-medium flex-1">{notification.message}</p>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="flex-shrink-0 text-xl leading-none opacity-50 hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
