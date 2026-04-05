# Notification/Toast System

A global notification system for displaying pop-up alerts (success, error, info, warning).

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

### Product Page - Add to Cart
```tsx
const handleAddToCart = async (product: Product) => {
  try {
    await api.post("/cart/add", { productId: product.id });
    toast.success(`${product.name} added to cart!`);
  } catch {
    toast.error("Failed to add to cart");
  }
};
```

### Admin Page - Delete Product
```tsx
const handleDeleteProduct = async (id: string) => {
  try {
    await api.delete(`/products/${id}`);
    toast.success("Product deleted");
    // refresh list
  } catch {
    toast.error("Failed to delete product");
  }
};
```

### Checkout - Order Confirmation
```tsx
const handleCheckout = async () => {
  try {
    const order = await api.post("/checkout", cartItems);
    toast.success("Order placed successfully!");
  } catch {
    toast.error("Checkout failed. Please try again.");
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
