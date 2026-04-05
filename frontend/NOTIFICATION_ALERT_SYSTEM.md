# Notification Alert System

A comprehensive notification system for displaying unread message counts, badges, and alerts throughout the application.

## Components

### 1. NotificationBadge
A reusable badge component for displaying counts on elements.

```tsx
import NotificationBadge from "@/components/NotificationBadge";

<div className="relative">
  <YourIcon />
  <NotificationBadge 
    count={5} 
    max={99}
    size="md"
    position="top-right"
    color="red"
  />
</div>
```

**Props:**
- `count` (number, required): Number to display
- `max` (number, optional, default: 99): Maximum number before showing "99+"
- `size` ("sm" | "md" | "lg", optional, default: "md"): Badge size
- `position` ("top-right" | "top-left" | "bottom-right" | "bottom-left", optional, default: "top-right"): Position
- `color` ("red" | "blue" | "green" | "yellow", optional, default: "red"): Badge color

### 2. NotificationBell
A bell icon with badge for unread messages.

```tsx
import NotificationBell from "@/components/NotificationBell";

<NotificationBell 
  size="md"
  showTooltip={true}
/>
```

**Props:**
- `className` (string, optional): Additional CSS classes
- `size` ("sm" | "md" | "lg", optional, default: "md"): Icon size
- `showTooltip` (boolean, optional, default: true): Show hover tooltip

**Features:**
- Automatically hides when count is 0
- Links to `/account/support`
- Shows unread message count
- Displays tooltip with count

### 3. NotificationList
A list component for displaying recent notifications/messages.

```tsx
import NotificationList from "@/components/NotificationList";

<NotificationList 
  limit={5}
  showViewAll={true}
/>
```

**Props:**
- `limit` (number, optional, default: 5): Number of notifications to display
- `showViewAll` (boolean, optional, default: true): Show "View all" link

**Features:**
- Shows recent unread messages
- Displays priority badges (high/medium/low)
- Shows time ago format
- Empty state when no notifications
- Clickable items that link to messages

## Context Provider

### useNotifications Hook

```tsx
import { useNotifications } from "@/lib/notification-alert-context";

const { unreadMessages, refreshNotifications } = useNotifications();
```

**Returns:**
- `unreadMessages` (number): Count of unread messages
- `refreshNotifications` (function): Manually refresh the count

**Features:**
- Auto-refreshes every 60 seconds
- Counts messages with status "open"
- Works across the entire app
- Integrated with backend `/messages` API

## Setup

The notification system is already integrated in the root layout:

```tsx
// src/app/layout.tsx
<AlertProvider>
  {children}
</AlertProvider>
```

## Usage Examples

### Example 1: Add Badge to Any Element

```tsx
import NotificationBadge from "@/components/NotificationBadge";

<button className="relative">
  <span>Messages</span>
  <NotificationBadge count={12} size="sm" position="top-right" />
</button>
```

### Example 2: Custom Notification Indicator

```tsx
import { useNotifications } from "@/lib/notification-alert-context";

const MyComponent = () => {
  const { unreadMessages } = useNotifications();
  
  return (
    <div>
      {unreadMessages > 0 && (
        <span className="text-red-600">
          You have {unreadMessages} new messages!
        </span>
      )}
    </div>
  );
};
```

### Example 3: Notification Dropdown

```tsx
import NotificationList from "@/components/NotificationList";

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>
        <NotificationBell />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Notifications</h3>
          </div>
          <NotificationList limit={10} />
        </div>
      )}
    </div>
  );
};
```

### Example 4: Integration in Navigation

```tsx
// Already implemented in NavBar.tsx
import NotificationBell from "@/components/NotificationBell";
import NotificationBadge from "@/components/NotificationBadge";
import { useNotifications } from "@/lib/notification-alert-context";

const { unreadMessages } = useNotifications();

<nav>
  <Link href="/account/support" className="relative">
    Support
    <NotificationBadge count={unreadMessages} size="sm" />
  </Link>
  
  <NotificationBell />
</nav>
```

## Advanced Features

### Manual Refresh

```tsx
const { refreshNotifications } = useNotifications();

// After sending a message
await api.post("/messages", data);
await refreshNotifications(); // Update count immediately
```

### Custom Notifications Page

```tsx
import NotificationList from "@/components/NotificationList";

export default function NotificationsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Notifications</h1>
      <div className="bg-white rounded-lg border">
        <NotificationList limit={20} showViewAll={false} />
      </div>
    </div>
  );
}
```

## Styling

All components use Tailwind CSS and follow the app's design system:
- Consistent spacing and typography
- Smooth transitions and hover effects
- Responsive design
- Accessible color contrast

## API Integration

The system automatically connects to:
- `GET /messages` - Fetches unread messages
- Counts messages with `status === "open"`
- Auto-refreshes every 60 seconds
- Only fetches when user is authenticated

## Future Enhancements

Potential additions:
- Push notifications
- Real-time WebSocket updates
- Notification preferences
- Mark as read functionality
- Different notification types (orders, promotions, etc.)
- Sound alerts
- Browser notifications API
