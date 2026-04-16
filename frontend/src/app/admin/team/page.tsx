"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/useToast";

type TeamMember = {
  id: string;
  role: "OWNER" | "STAFF";
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "customer" | "admin";
  };
};

export default function TeamManagementPage() {
  const { activeShopId, user } = useAuth();
  const toast = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [error, setError] = useState<string | null>(null);

  const loadMembers = async () => {
    if (!activeShopId) {
      setMembers([]);
      setLoading(false);
      setError("Select an active shop first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/shops/${activeShopId}/members`);
      setMembers((response.data.members || []) as TeamMember[]);
    } catch (loadError) {
      const message =
        (loadError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Unable to load team members.";
      setError(message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, [activeShopId]);

  const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeShopId) {
      toast.error("No active shop selected.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/shops/${activeShopId}/members`, {
        email: email.trim(),
        role,
      });

      toast.success(response.data?.message || "Team member saved.");
      setEmail("");
      setRole("STAFF");
      await loadMembers();
    } catch (submitError) {
      const message =
        (submitError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Unable to add member.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!activeShopId) {
      toast.error("No active shop selected.");
      return;
    }

    const confirmed = window.confirm(`Remove ${member.user.name} from this shop?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/shops/${activeShopId}/members/${member.user.id}`);
      toast.success("Member removed.");
      await loadMembers();
    } catch (removeError) {
      const message =
        (removeError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Unable to remove member.";
      toast.error(message);
    }
  };

  return (
    <AdminShell title="Team Management" ownerOnly>
      <section className="space-y-6">
        <div className="rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Add team member</p>
          <p className="mt-2 text-sm text-black/65">
            Add an existing account to this shop by email. If the user is already in the shop, role will be updated.
          </p>

          <form onSubmit={handleAddMember} className="mt-4 grid gap-3 md:grid-cols-[1.4fr_0.7fr_auto] md:items-end">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                required
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black/30"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as "OWNER" | "STAFF")}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black outline-none transition focus:border-black/30"
              >
                <option value="STAFF">STAFF</option>
                <option value="OWNER">OWNER</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Add member"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Current team</p>
            <button
              type="button"
              onClick={() => void loadMembers()}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/3"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-2xl border border-black/10 bg-black/3" />
              ))}
            </div>
          ) : error ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : members.length > 0 ? (
            <div className="mt-3 space-y-2">
              {members.map((member) => {
                const isCurrentUser = member.user.id === user?.id;
                const isOwner = member.role === "OWNER";
                return (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-black">{member.user.name}</p>
                      <p className="text-xs text-black/55">{member.user.email}</p>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          member.role === "OWNER" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {member.role}
                      </span>

                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(member)}
                        disabled={isOwner || isCurrentUser}
                        className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          isOwner
                            ? "Owner cannot be removed"
                            : isCurrentUser
                            ? "You cannot remove your own membership"
                            : "Remove member"
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-black/15 bg-black/2 px-4 py-5 text-center text-sm text-black/60">
              No members found for this shop.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
