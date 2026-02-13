"use client";

import Link from "next/link";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-wide">
          Ellora Supply
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/shop">Shop</Link>
          <Link href="/account/orders">Orders</Link>
          <Link href="/admin">Admin</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition hover:border-black/20"
          >
            Sign in
          </Link>
          <Link
            href="/shop"
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80"
          >
            Start shopping
          </Link>
        </div>
      </div>
    </header>
  );
}
