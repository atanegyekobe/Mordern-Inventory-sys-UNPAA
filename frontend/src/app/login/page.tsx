"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/useToast";

type ShopOption = {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "STAFF";
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finishAuth = async (payload: {
    token: string;
    user: { role: string };
    shops?: ShopOption[];
    activeShopId?: string | null;
    requiresShopSelection?: boolean;
  }) => {
    await login(payload);

    const hasShops = (payload.shops?.length || 0) > 0;
    const isAdminUser = payload.user.role === "admin" || hasShops;
    toast.success("Signed in successfully!");
    setTimeout(() => router.push(isAdminUser ? "/admin/dashboard" : "/shop"), 800);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      const payload = response.data;

      if (payload.requiresShopSelection && !payload.activeShopId) {
        const availableShops = Array.isArray(payload.shops) ? payload.shops : [];
        setShops(availableShops);
        setSelectedShopId(availableShops[0]?.id || "");
        toast.error("Select a shop to continue.");
        return;
      }

      await finishAuth(payload);
    } catch {
      toast.error("Unable to sign in. Check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShopSelectionLogin = async () => {
    if (!selectedShopId) {
      toast.error("Choose a shop first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
        activeShopId: selectedShopId,
      });

      await finishAuth(response.data);
    } catch {
      toast.error("Unable to complete sign in for selected shop.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-rose-50 via-orange-50/50 to-cyan-50/50">
      <NavBar />
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <div className="rounded-3xl border border-rose-100 bg-white/90 p-7 shadow-sm">
          <h1 className="text-3xl font-semibold">Welcome back.</h1>
          <p className="mt-2 text-sm text-black/60">
            Sign in to access your account and continue shopping.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-2xl border border-rose-100 bg-white px-4 py-3 outline-none focus:border-rose-300"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-rose-100 bg-white px-4 py-3 outline-none focus:border-rose-300"
              required
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          {shops.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-800">Select your active shop</p>
              <select
                value={selectedShopId}
                onChange={(event) => setSelectedShopId(event.target.value)}
                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} ({shop.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleShopSelectionLogin}
                disabled={isSubmitting || !selectedShopId}
                className="w-full rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
              >
                Continue with selected shop
              </button>
            </div>
          )}
          </form>
          <p className="mt-5 text-sm text-black/60">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-sky-700 underline">
            Sign up
          </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
