# Notification/Toast System

A global notification system for displaying pop-up alerts (success, error, info, warning).

## Current Process Notes (April 2026)

- Used across storefront, admin, and POS workflows.
- Critical POS examples now include out-of-stock warnings, sale confirmation, and print fallback notices.
- Team-management and role-based admin actions should surface clear permission toasts when denied.

## Usage

```tsx
"use client";

import { useToast } from "@/hooks/useToast";

export function MyComponent() {
  const toast = useToast();

  const handleAddToCart = async () => {
    try {
      // Add to cart logic
      toast.success("Added to cart!");
    } catch (error) {
      toast.error("Failed to add to cart");
    }
  };

  return (
    <button onClick={handleAddToCart}>
      Add to Cart
    </button>
  );
}
```

## Available Toast Methods

```tsx
// Success notification (auto-dismisses after 3 seconds)
toast.success("Product added successfully!");

// Error notification
toast.error("Something went wrong");

// Info notification
toast.info("Here's some information");

// Warning notification
toast.warning("Please be careful");

// Custom duration (in milliseconds)
toast.success("This will stay for 5 seconds", 5000);

// Persistent notification (never auto-dismisses)
toast.info("Important message", 0);
```

## Types

- **success**: Green toast with checkmark icon
- **error**: Red toast with X icon
- **info**: Blue toast with info icon
- **warning**: Yellow toast with warning icon

## Features

- ✅ Auto-dismiss after 3 seconds (default)
- ✅ Manual dismiss button (×)
- ✅ Smooth animations (slide in/out)
- ✅ Stack multiple notifications
- ✅ Works on both client and admin pages
- ✅ TypeScript support

## Examples

### POS - Add to Cart
```tsx
const handleAddToCart = async (product: Product) => {
  try {
    if (product.stock <= 0) {
      toast.warning(`${product.name} is out of stock.`);
      return;
    }
    toast.success(`${product.name} added to cart!`);
  } catch {
    toast.error("Failed to add to cart");
  }
};
```

### Admin Page - Save Team Member
```tsx
const handleAddMember = async () => {
  try {
    await api.post(`/shops/${activeShopId}/members`, { email, role });
    toast.success("Team member saved.");
  } catch {
    toast.error("Unable to add member.");
  }
};
```

### POS - Complete Sale
```tsx
const handleCompleteSale = async () => {
  try {
    await api.post("/pos/sale", { items, note });
    toast.success("Sale completed successfully.");
  } catch {
    toast.error("Failed to complete sale.");
  }
};
```

### Form Validation
```tsx
const handleSubmit = (data) => {
  if (!data.email) {
    toast.warning("Please enter an email");
    return;
  }
  
  toast.success("Form submitted!");
};
```
