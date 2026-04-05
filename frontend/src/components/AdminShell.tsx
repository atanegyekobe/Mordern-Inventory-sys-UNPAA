"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import { AdminRoute } from "./RouteGuards";

type AdminShellProps = {
  title: string;
  children: React.ReactNode;
};

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/sales", label: "Sales Management" },
  { href: "/admin/pos", label: "POS" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/import", label: "CSV Import" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/sla", label: "SLA & Automation" },
  { href: "/admin/observability", label: "Observability" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/messages", label: "Messages" },
];

export default function AdminShell({ title, children }: AdminShellProps) {
  const pathname = usePathname();
  const isActiveLink = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <AdminRoute>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,transparent_26%),radial-gradient(circle_at_top_right,#cffafe_0%,transparent_24%),linear-gradient(180deg,#fafaf9_0%,#f8fafc_100%)]">
        <NavBar />
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-5 overflow-x-auto pb-2 md:hidden">
            <div className="flex min-w-max gap-2">
              {links.map((link) => {
                const active = isActiveLink(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200 ${
                      active
                        ? "border-black bg-black text-white! shadow-[0_8px_16px_-10px_rgba(0,0,0,0.8)]"
                        : "border-black/15 bg-white/90 text-black/80! hover:border-black/35 hover:bg-black hover:text-white!"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden md:block">
              <div className="sticky top-24 overflow-hidden rounded-3xl border border-black/10 bg-white/85 p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)] backdrop-blur">
                <div className="mb-4 rounded-2xl border border-black/10 bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#0f172a_100%)] p-4 text-white">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/70">
                    Admin Workspace
                  </p>
                  <p className="mt-2 text-lg font-semibold leading-tight">
                    {title}
                  </p>
                </div>

                <nav className="space-y-1.5">
                  {links.map((link) => {
                    const active = isActiveLink(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`group flex items-center justify-between rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                          active
                            ? "border-black bg-black text-white! shadow-[0_10px_20px_-14px_rgba(0,0,0,0.9)]"
                            : "border-transparent bg-black/2 text-black/80! hover:border-black/20 hover:bg-black hover:text-white!"
                        }`}
                      >
                        <span>{link.label}</span>
                        <span
                          className={`text-[10px] transition-colors duration-200 ${
                            active ? "text-white/70" : "text-black/45 group-hover:text-white/75"
                          }`}
                        >
                          /&gt;
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <main>
              <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">{title}</h1>
              <div className="mt-5 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.45)] sm:p-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
