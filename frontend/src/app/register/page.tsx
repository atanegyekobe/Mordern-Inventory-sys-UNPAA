"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/useToast";

type SignupRole = "customer" | "business";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("customer");
  const [shopName, setShopName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (role === "business" && !shopName.trim()) {
      toast.error("Shop name is required for business accounts.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post("/auth/register", {
        name,
        email,
        password,
        type: role,
        shopName: role === "business" ? shopName.trim() : undefined,
      });
      await login(response.data);
      toast.success("Account created successfully!");

      const hasShops = (response.data.shops?.length || 0) > 0;
      const nextPath = response.data.user?.role === "admin" || hasShops ? "/admin/dashboard" : "/shop";
      setTimeout(() => router.push(nextPath), 800);
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const errorMessage = axiosError?.response?.data?.message || "Unable to create account.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-rose-50 via-orange-50/50 to-cyan-50/50">
      <NavBar />
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <div className="rounded-3xl border border-orange-100 bg-white/90 p-7 shadow-sm">
          <h1 className="text-3xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-black/60">
            Join Ellora Supply and start shopping for curated collections.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
              Account type
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("customer")}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  role === "customer"
                    ? "bg-orange-500 text-white"
                    : "border border-orange-200 bg-white text-black/70"
                }`}
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => setRole("business")}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  role === "business"
                    ? "bg-orange-500 text-white"
                    : "border border-orange-200 bg-white text-black/70"
                }`}
              >
                Business
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Full Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-2xl border border-orange-100 bg-white px-4 py-3 outline-none focus:border-orange-300"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-2xl border border-orange-100 bg-white px-4 py-3 outline-none focus:border-orange-300"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-orange-100 bg-white px-4 py-3 outline-none focus:border-orange-300"
              minLength={6}
              required
            />
          </label>

          {role === "business" && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              Shop Name
              <input
                type="text"
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 outline-none focus:border-orange-300"
                required
              />
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:opacity-50"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
          </form>
          <p className="mt-5 text-sm text-black/60">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-sky-700 underline">
            Sign in
          </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
