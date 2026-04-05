"use client";

import { useToast } from "@/hooks/useToast";

/**
 * Example component showing how to use the notification/toast system
 * This is just for reference and can be deleted
 */
export function ToastExample() {
  const toast = useToast();

  return (
    <div className="p-6 bg-gray-50 rounded-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Toast Notification Examples</h2>
      
      <div className="space-y-3">
        <button
          onClick={() => toast.success("Product added to cart successfully!")}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Show Success Toast
        </button>

        <button
          onClick={() => toast.error("Failed to add product. Please try again.")}
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Show Error Toast
        </button>

        <button
          onClick={() => toast.info("Your order has been updated")}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Show Info Toast
        </button>

        <button
          onClick={() => toast.warning("Inventory is running low")}
          className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
        >
          Show Warning Toast
        </button>

        <button
          onClick={() => toast.success("This will stay for 5 seconds", 5000)}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
        >
          Show Long-Duration Toast
        </button>

        <button
          onClick={() => toast.info("This notification never auto-dismiss", 0)}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
        >
          Show Persistent Toast
        </button>
      </div>

      <div className="mt-8 p-4 bg-white rounded border border-gray-200">
        <h3 className="font-semibold mb-2">Usage:</h3>
        <code className="text-sm bg-gray-100 p-2 rounded block overflow-x-auto">
          {`import { useToast } from "@/hooks/useToast";

// In your component:
const toast = useToast();
toast.success("Message here!");`}
        </code>
      </div>
    </div>
  );
}
