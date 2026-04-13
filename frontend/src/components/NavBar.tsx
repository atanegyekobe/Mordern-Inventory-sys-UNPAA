"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/useToast";
import { useNotifications } from "@/lib/notification-alert-context";
import NotificationBadge from "@/components/NotificationBadge";
import NotificationBell from "@/components/NotificationBell";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, shops, logout } = useAuth();
  const toast = useToast();
  const { unreadMessages } = useNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const firstName = user?.name?.split(" ")[0] ?? "Guest";

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navLinkClass = (href: string) => {
    const active = isActiveRoute(href);

    return `relative rounded-full px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-linear-to-r from-rose-500 to-orange-500 text-white"
        : "text-black/70 hover:bg-rose-50 hover:text-black"
    }`;
  };

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    logout();
    toast.success("Signed out successfully!");
    router.push("/");
  };

  const hasShopAccess = Boolean(user && (user.role === "admin" || shops.length > 0));

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="mx-auto w-full max-w-6xl">
        <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white/85 shadow-[0_12px_30px_-18px_rgba(18,17,14,0.45)] backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 via-orange-500 to-amber-500 text-xs font-black tracking-[0.2em] text-white">
                ES
              </span>
              <span className="truncate text-lg font-semibold tracking-[0.08em] md:text-xl">EllY&apos;Shop</span>
            </Link>

            <nav className="ml-2 hidden items-center gap-1 md:flex">
              <Link href="/shop" className={navLinkClass("/shop")}>Shop</Link>
              {user && (
                <>
                  <Link href="/account/profile" className={navLinkClass("/account/profile")}>Profile</Link>
                  <Link href="/account/support" className={navLinkClass("/account/support")}>
                    Messages
                    <NotificationBadge count={unreadMessages} size="sm" />
                  </Link>
                </>
              )}
              {!user && <Link href="/support" className={navLinkClass("/support")}>Talk 2 Us</Link>}
              {hasShopAccess && (
                <Link href="/admin/dashboard" className={navLinkClass("/admin")}>Manage Store</Link>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {user && (
                <>
                  <NotificationBell />
                </>
              )}

              {user ? (
                <>
                  <div className="hidden items-center gap-1 rounded-full bg-black/4 px-3 py-2 text-sm md:flex">
                    <span className="text-black/50">Hi,</span>
                    <span className="font-semibold text-black/90">{firstName}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition hover:border-black/20 hover:bg-black hover:text-white md:inline-flex"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition hover:border-black/20 md:inline-flex"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="hidden rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:from-rose-600 hover:to-orange-600 md:inline-flex"
                  >
                    Sign up
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="inline-flex rounded-full border border-rose-100 bg-white p-2.5 text-black/70 transition hover:border-rose-300 hover:text-black md:hidden"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="border-t border-rose-100 bg-white/95 px-3 pb-3 pt-2 md:hidden">
              {user && (
                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/55">
                  Signed in as {firstName}
                </p>
              )}

              <nav className="grid gap-1">
                <Link href="/shop" className={navLinkClass("/shop")} onClick={() => setIsMobileMenuOpen(false)}>Shop</Link>
                {user && (
                  <>
                    <Link href="/account/profile" className={navLinkClass("/account/profile")} onClick={() => setIsMobileMenuOpen(false)}>Profile</Link>
                    <Link href="/account/support" className={navLinkClass("/account/support")} onClick={() => setIsMobileMenuOpen(false)}>Messages</Link>
                  </>
                )}
                {!user && <Link href="/support" className={navLinkClass("/support")} onClick={() => setIsMobileMenuOpen(false)}>Support</Link>}
                {hasShopAccess && <Link href="/admin/dashboard" className={navLinkClass("/admin")} onClick={() => setIsMobileMenuOpen(false)}>Manage Store</Link>}
              </nav>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="col-span-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition hover:border-black/20 hover:bg-black hover:text-white"
                  >
                    Sign out
                  </button>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="rounded-full border border-black/10 px-4 py-2 text-center text-sm font-medium transition hover:border-black/20"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-4 py-2 text-center text-sm font-medium text-white transition hover:from-rose-600 hover:to-orange-600"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
