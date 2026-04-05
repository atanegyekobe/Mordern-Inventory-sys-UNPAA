"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-alert-context";
import BackButton from "@/components/BackButton";
import api from "@/lib/api";

export default function SupportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshNotifications } = useNotifications();
  const [formData, setFormData] = useState({
    subject: "",
    content: "",
    priority: "low",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push("/login?redirect=/support");
      return;
    }

    if (!formData.subject.trim() || !formData.content.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post("/messages", formData);
      setSuccess(true);
      setFormData({ subject: "", content: "", priority: "low" });
      await refreshNotifications();
      
      setTimeout(() => {
        router.push("/account/support");
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-amber-50/60 via-white to-sky-50/40 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <BackButton />
        </div>

        <section className="mb-6 rounded-3xl border border-black/10 bg-linear-to-r from-rose-100/70 via-amber-50 to-cyan-100/70 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">Customer Support</p>
          <h1 className="mt-2 text-3xl font-semibold text-black md:text-4xl">Tell us what you need.</h1>
          <p className="mt-2 max-w-2xl text-sm text-black/65">
            Need help? Send us a message and we&apos;ll get back to you as soon as possible.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white p-8 shadow-sm">

            {success ? (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold">Message sent successfully!</p>
                    <p className="text-sm">Redirecting to your messages...</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
                    {error}
                  </div>
                )}

                {!user && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-800">
                    <p className="font-semibold mb-2">Login required</p>
                    <p className="text-sm">
                      You need to be logged in to send a support message.
                    </p>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium text-black/75">Quick priority</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "low", label: "General question" },
                      { value: "medium", label: "Need assistance" },
                      { value: "high", label: "Urgent issue" },
                    ].map((priority) => (
                      <button
                        key={priority.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: priority.value })}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          formData.priority === priority.value
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-black/15 bg-white text-black/65 hover:border-black/30"
                        }`}
                      >
                        {priority.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="mb-2 block text-sm font-medium text-black/75">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    placeholder="Brief description of your issue"
                    className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="priority" className="mb-2 block text-sm font-medium text-black/75">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <option value="low">Low - General inquiry</option>
                    <option value="medium">Medium - Need assistance</option>
                    <option value="high">High - Urgent issue</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="content" className="mb-2 block text-sm font-medium text-black/75">
                    Message *
                  </label>
                  <textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    placeholder="Please describe your issue or question in detail..."
                    rows={8}
                    className="w-full resize-none rounded-xl border border-black/10 px-4 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20"
                    required
                  />
                  <p className="mt-2 text-xs text-black/50">{formData.content.length} characters</p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={loading || !user}
                    className="flex-1 rounded-xl bg-linear-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send Message"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-xl border border-black/15 px-6 py-3 text-sm font-semibold text-black/75 transition hover:bg-black/5"
                  >
                    Cancel
                  </button>
                </div>

                {user && (
                  <p className="text-center text-sm text-black/55">
                    You can view all your messages in{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/account/support")}
                      className="font-semibold text-sky-700 hover:underline"
                    >
                      My Support
                    </button>
                  </p>
                )}
              </form>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Response Guide</p>
              <div className="mt-3 space-y-3 text-sm text-black/65">
                <p><span className="font-semibold text-black/80">Low:</span> General questions and non-urgent updates.</p>
                <p><span className="font-semibold text-black/80">Medium:</span> Order follow-up or account assistance.</p>
                <p><span className="font-semibold text-black/80">High:</span> Payment or delivery-critical issues.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Tips for Faster Help</p>
              <ul className="mt-3 space-y-2 text-sm text-black/65">
                <li>Include order ID and date.</li>
                <li>Describe expected vs actual result.</li>
                <li>Add steps already attempted.</li>
              </ul>
            </div>
          </aside>
        </div>

        {/* FAQ Section */}
        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-black">Common Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 font-medium text-black">How long does it take to get a response?</h3>
              <p className="text-sm text-black/60">
                We typically respond within 24 hours during business days. High priority messages are addressed first.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium text-black">Can I track my support ticket?</h3>
              <p className="text-sm text-black/60">
                Yes! Go to <span className="font-medium">My Support</span> in your account to view all your messages and their status.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium text-black">What about order issues?</h3>
              <p className="text-sm text-black/60">
                For order-related issues, please include your order ID in the message. You can find it in your order history.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
