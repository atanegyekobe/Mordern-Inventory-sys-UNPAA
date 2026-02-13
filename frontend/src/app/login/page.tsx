"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    try {
      const response = await api.post("/auth/login", { email, password });
      window.localStorage.setItem("ellora_token", response.data.token);
      setMessage("Signed in successfully. Redirecting to admin...");
      setTimeout(() => router.push("/admin"), 800);
    } catch {
      setMessage("Unable to sign in. Check your credentials.");
    }
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold">Welcome back.</h1>
        <p className="text-sm text-black/60">
          Use your admin credentials to access the control center.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-2xl border border-black/10 bg-white px-4 py-3"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-black/10 bg-white px-4 py-3"
              required
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            Sign in
          </button>
        </form>
        {message ? <p className="text-sm text-black/60">{message}</p> : null}
      </div>
    </div>
  );
}
