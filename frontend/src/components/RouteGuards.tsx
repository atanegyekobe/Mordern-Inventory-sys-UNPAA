"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (typeof window === "undefined" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" suppressHydrationWarning>
        <p className="text-sm text-black/60">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, shops, isLoading } = useAuth();
  const canAccessAdmin = Boolean(user && (user.role === "admin" || shops.length > 0));

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
      } else if (!canAccessAdmin) {
        router.push("/");
      }
    }
  }, [user, shops.length, isLoading, router, canAccessAdmin]);

  if (typeof window === "undefined" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" suppressHydrationWarning>
        <p className="text-sm text-black/60">Loading...</p>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return null;
  }

  return <>{children}</>;
}
