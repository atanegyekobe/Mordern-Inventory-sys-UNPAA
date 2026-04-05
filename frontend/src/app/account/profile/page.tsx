"use client";

import Link from "next/link";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { ProtectedRoute } from "@/components/RouteGuards";
import { useAuth } from "@/lib/auth-context";

export default function ProfilePage() {
  const { user, shops, activeShopId } = useAuth();

  const activeShop = shops.find((shop) => shop.id === activeShopId) || null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-linear-to-b from-rose-50 via-amber-50/40 to-cyan-50/60">
        <NavBar />
        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">My Account</p>
            <h1 className="mt-2 text-3xl font-semibold text-black">Profile</h1>
            <p className="mt-2 text-sm text-black/60">
              View your account details. Editing options can be added in the next phase.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-black/55">Personal details</h2>

              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-black/2 p-4">
                  <dt className="text-xs uppercase tracking-[0.14em] text-black/50">Full name</dt>
                  <dd className="mt-1 text-base font-semibold text-black">{user?.name || "-"}</dd>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/2 p-4">
                  <dt className="text-xs uppercase tracking-[0.14em] text-black/50">Email</dt>
                  <dd className="mt-1 text-base font-semibold text-black break-all">{user?.email || "-"}</dd>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/2 p-4">
                  <dt className="text-xs uppercase tracking-[0.14em] text-black/50">Role</dt>
                  <dd className="mt-1 text-base font-semibold text-black capitalize">{user?.role || "-"}</dd>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/2 p-4">
                  <dt className="text-xs uppercase tracking-[0.14em] text-black/50">Shop access</dt>
                  <dd className="mt-1 text-base font-semibold text-black">{shops.length}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-black/55">Store context</h2>

              {activeShop ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-700/80">Active shop</p>
                  <p className="mt-1 text-base font-semibold text-emerald-900">{activeShop.name}</p>
                  <p className="mt-1 text-xs text-emerald-800/80">/{activeShop.slug}</p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-black/10 bg-black/2 p-4 text-sm text-black/60">
                  No active shop selected.
                </div>
              )}

              <div className="mt-4 space-y-2">
                {shops.map((shop) => (
                  <div key={shop.id} className="rounded-xl border border-black/10 bg-white px-3 py-2">
                    <p className="text-sm font-semibold text-black">{shop.name}</p>
                    <p className="text-xs text-black/55">Role: {shop.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/account/orders"
              className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-black transition hover:border-black/30"
            >
              View orders
            </Link>
            <Link
              href="/account/support"
              className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-black transition hover:border-black/30"
            >
              Support messages
            </Link>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}
