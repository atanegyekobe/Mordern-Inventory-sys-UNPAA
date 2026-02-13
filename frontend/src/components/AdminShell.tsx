"use client";

import Link from "next/link";
import NavBar from "./NavBar";

type AdminShellProps = {
  title: string;
  children: React.ReactNode;
};

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
];

export default function AdminShell({ title, children }: AdminShellProps) {
  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-10">
        <aside className="hidden w-52 flex-col gap-3 text-sm font-semibold md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-black/10 px-4 py-3 transition hover:border-black/25"
            >
              {link.label}
            </Link>
          ))}
        </aside>
        <main className="flex-1">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
