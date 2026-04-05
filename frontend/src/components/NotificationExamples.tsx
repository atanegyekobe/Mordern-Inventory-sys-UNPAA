"use client";

import { useState } from "react";
import NotificationBadge from "@/components/NotificationBadge";
import NotificationBell from "@/components/NotificationBell";
import NotificationList from "@/components/NotificationList";
import { useNotifications } from "@/lib/notification-alert-context";

/**
 * Example component demonstrating all notification alert features
 * This is for reference and can be deleted
 */
export default function NotificationExamples() {
  const { unreadMessages, refreshNotifications } = useNotifications();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Notification Alert System</h1>
        <p className="text-black/60">
          Examples of notification components and patterns
        </p>
      </div>

      {/* Current Status */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Current Status</h2>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold">{unreadMessages}</div>
          <div>
            <p className="font-medium">Unread Messages</p>
            <button
              onClick={() => refreshNotifications()}
              className="text-sm text-blue-600 hover:underline"
            >
              Refresh count
            </button>
          </div>
        </div>
      </div>

      {/* Notification Bell */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Notification Bell</h2>
        <div className="flex items-center gap-4">
          <NotificationBell size="sm" />
          <NotificationBell size="md" />
          <NotificationBell size="lg" />
        </div>
        <p className="mt-4 text-sm text-black/60">
          Bell icon automatically hides when count is 0
        </p>
      </div>

      {/* Notification Badges */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Notification Badges</h2>
        
        <div className="space-y-6">
          {/* Sizes */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-black/60">Sizes</h3>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={5} size="sm" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={5} size="md" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={5} size="lg" />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-black/60">Colors</h3>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={3} color="red" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={3} color="blue" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={3} color="green" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={3} color="yellow" />
              </div>
            </div>
          </div>

          {/* Positions */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-black/60">Positions</h3>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={1} position="top-right" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={2} position="top-left" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={3} position="bottom-right" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={4} position="bottom-left" />
              </div>
            </div>
          </div>

          {/* Large numbers */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-black/60">Large Numbers</h3>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={99} />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={100} max={99} />
              </div>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <NotificationBadge count={999} max={999} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Notification List</h2>
          <p className="text-sm text-black/60 mt-1">
            Recent unread messages from your account
          </p>
        </div>
        <NotificationList limit={5} showViewAll={true} />
      </div>

      {/* Dropdown Example */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Dropdown Example</h2>
        <div className="relative inline-block">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-black/80 transition"
          >
            <span>Show Notifications</span>
            {unreadMessages > 0 && (
              <span className="bg-white text-black rounded-full px-2 py-0.5 text-xs font-semibold">
                {unreadMessages}
              </span>
            )}
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border z-20">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold">Notifications</h3>
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="text-black/40 hover:text-black"
                  >
                    ×
                  </button>
                </div>
                <NotificationList limit={10} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Usage Code */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Usage</h2>
        <pre className="text-xs bg-white p-4 rounded border overflow-x-auto">
          {`import { useNotifications } from "@/lib/notification-alert-context";
import NotificationBell from "@/components/NotificationBell";
import NotificationBadge from "@/components/NotificationBadge";

const { unreadMessages } = useNotifications();

// Bell icon
<NotificationBell />

// Badge on any element
<div className="relative">
  <YourElement />
  <NotificationBadge count={unreadMessages} />
</div>

// In navigation
<Link href="/messages" className="relative">
  Messages
  <NotificationBadge count={unreadMessages} size="sm" />
</Link>`}
        </pre>
      </div>
    </div>
  );
}
