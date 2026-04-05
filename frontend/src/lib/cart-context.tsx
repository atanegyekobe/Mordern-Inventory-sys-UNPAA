"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "@/lib/api";

type CartContextValue = {
  cartCount: number;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue>({
  cartCount: 0,
  refreshCart: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    try {
      const token = window.localStorage.getItem("ellora_token");
      if (!token) {
        setCartCount(0);
        return;
      }

      const response = await api.get("/cart");
      const totalItems = response.data.totals?.items ?? 0;
      setCartCount(totalItems);
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await refreshCart();
    };

    load();
  }, [refreshCart]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
