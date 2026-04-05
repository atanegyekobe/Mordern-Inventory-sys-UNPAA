"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
};

type ShopSummary = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: "OWNER" | "STAFF";
  config?: Record<string, unknown>;
};

type AuthResponse = {
  token: string;
  user: User;
  shops?: ShopSummary[];
  activeShopId?: string | null;
  requiresShopSelection?: boolean;
};

type AuthContextValue = {
  user: User | null;
  shops: ShopSummary[];
  activeShopId: string | null;
  isLoading: boolean;
  login: (payload: AuthResponse) => Promise<void>;
  setActiveShop: (shopId: string | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const TOKEN_STORAGE_KEY = "ellora_token";
const SHOPS_STORAGE_KEY = "ellora_shops";
const ACTIVE_SHOP_STORAGE_KEY = "ellora_active_shop_id";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  shops: [],
  activeShopId: null,
  isLoading: true,
  login: async () => {},
  setActiveShop: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveShopState = useCallback((nextShops: ShopSummary[], nextActiveShopId: string | null) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(SHOPS_STORAGE_KEY, JSON.stringify(nextShops || []));

    if (nextActiveShopId) {
      window.localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, nextActiveShopId);
    } else {
      window.localStorage.removeItem(ACTIVE_SHOP_STORAGE_KEY);
    }

    setShops(nextShops || []);
    setActiveShopId(nextActiveShopId || null);
  }, []);

  const hydrateShopStateFromStorage = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawShops = window.localStorage.getItem(SHOPS_STORAGE_KEY);
    const storedActiveShopId = window.localStorage.getItem(ACTIVE_SHOP_STORAGE_KEY);

    if (rawShops) {
      try {
        const parsed = JSON.parse(rawShops) as ShopSummary[];
        setShops(Array.isArray(parsed) ? parsed : []);
      } catch {
        setShops([]);
      }
    }

    setActiveShopId(storedActiveShopId || null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (typeof window === "undefined") return;
    
    try {
      const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setUser(null);
        setShops([]);
        setActiveShopId(null);
        setIsLoading(false);
        return;
      }

      hydrateShopStateFromStorage();

      const response = await api.get("/auth/me");
      setUser(response.data.user);
    } catch {
      setUser(null);
      setShops([]);
      setActiveShopId(null);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(SHOPS_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_SHOP_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [hydrateShopStateFromStorage]);

  useEffect(() => {
    const load = async () => {
      await refreshUser();
    };

    load();
  }, [refreshUser]);

  const login = async (payload: AuthResponse) => {
    const nextShops = payload.shops || [];
    const nextActiveShopId = payload.activeShopId || null;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
    }

    saveShopState(nextShops, nextActiveShopId);
    await refreshUser();
  };

  const setActiveShop = (shopId: string | null) => {
    saveShopState(shops, shopId);
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(SHOPS_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_SHOP_STORAGE_KEY);
    }
    setUser(null);
    setShops([]);
    setActiveShopId(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, shops, activeShopId, isLoading, login, setActiveShop, logout, refreshUser }}
    >
      <div suppressHydrationWarning>{children}</div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
