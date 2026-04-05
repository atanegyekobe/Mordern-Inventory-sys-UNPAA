"use client";

import Link from "next/link";
import { useNotifications } from "@/lib/notification-alert-context";
import NotificationBadge from "./NotificationBadge";

interface NotificationBellProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

export default function NotificationBell({
  className = "",
  size = "md",
  showTooltip = true,
}: NotificationBellProps) {
  const { unreadMessages } = useNotifications();

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const badgeSizes = {
    sm: "sm" as const,
    md: "md" as const,
    lg: "md" as const,
  };

  if (unreadMessages === 0) return null;

  const tooltip = showTooltip
    ? `${unreadMessages} unread message${unreadMessages !== 1 ? "s" : ""}`
    : undefined;

  return (
    <Link
      href="/account/support"
      className={`relative rounded-full border border-black/10 p-2 transition hover:border-black/20 hover:bg-black/5 ${className}`}
      title={tooltip}
    >
      <svg
        className={iconSizes[size]}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      <NotificationBadge count={unreadMessages} size={badgeSizes[size]} color="red" />
    </Link>
  );
}
