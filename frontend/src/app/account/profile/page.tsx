"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import { ProtectedRoute } from "@/components/RouteGuards";
import { useAuth } from "@/lib/auth-context";
import api from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { toAssetUrl } from "@/lib/assets";

export default function ProfilePage() {
  const toast = useToast();
  const { user, shops, activeShopId, updateShopSummary } = useAuth();

  const activeShop = shops.find((shop) => shop.id === activeShopId) || null;
  const canRenameShop = Boolean(user && (user.role === "admin" || activeShop?.role === "OWNER"));
  const activeShopLogo =
    activeShop?.config && typeof activeShop.config === "object"
      ? ((activeShop.config as { branding?: { logo?: string } }).branding?.logo || "")
      : "";

  const [shopNameInput, setShopNameInput] = useState(activeShop?.name || "");
  const [shopLogoInput, setShopLogoInput] = useState(activeShopLogo);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRenamingShop, setIsRenamingShop] = useState(false);

  useEffect(() => {
    setShopNameInput(activeShop?.name || "");
    setShopLogoInput(activeShopLogo);
  }, [activeShop?.id, activeShop?.name, activeShopLogo]);

  const handleUploadLogoFile = async () => {
    if (!activeShop) {
      toast.error("No active shop selected.");
      return;
    }

    if (!logoFile) {
      toast.error("Choose a logo image first.");
      return;
    }

    try {
      setIsUploadingLogo(true);
      const payload = new FormData();
      payload.append("logo", logoFile);

      const response = await api.post(`/shops/${activeShop.id}/logo`, payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const uploadedLogoUrl = String(response.data?.logoUrl || "").trim();
      const updated = response.data?.shop;

      if (updated?.id) {
        updateShopSummary(updated.id, {
          name: updated.name,
          slug: updated.slug,
          config: updated.config,
        });
      }

      if (uploadedLogoUrl) {
        setShopLogoInput(uploadedLogoUrl);
      }

      setLogoFile(null);
      toast.success(response.data?.message || "Logo uploaded successfully.");
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Unable to upload logo file.";
      toast.error(message);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRenameShop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeShop) {
      toast.error("No active shop selected.");
      return;
    }

    const trimmed = shopNameInput.trim();
    if (!trimmed) {
      toast.error("Shop name is required.");
      return;
    }

    const trimmedLogo = shopLogoInput.trim();

    if (trimmed === activeShop.name && trimmedLogo === activeShopLogo) {
      toast.info("Shop details are unchanged.");
      return;
    }

    try {
      setIsRenamingShop(true);
      const response = await api.patch(`/shops/${activeShop.id}`, {
        name: trimmed,
        logoUrl: trimmedLogo,
      });

      const updated = response.data?.shop;
      if (updated?.id) {
        updateShopSummary(updated.id, {
          name: updated.name,
          slug: updated.slug,
          config: updated.config,
        });
      }

      setShopNameInput(updated?.name || trimmed);
      setShopLogoInput(updated?.config?.branding?.logo || trimmedLogo);
      toast.success(response.data?.message || "Shop details updated successfully.");
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Unable to update shop details.";
      toast.error(message);
    } finally {
      setIsRenamingShop(false);
    }
  };

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
                  {activeShopLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAssetUrl(activeShopLogo)}
                      alt={`${activeShop.name} logo`}
                      className="mt-3 h-10 w-10 rounded-full border border-emerald-200 object-cover"
                    />
                  ) : null}
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

              {activeShop && canRenameShop ? (
                <form onSubmit={handleRenameShop} className="mt-5 rounded-2xl border border-black/10 bg-black/2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Shop identity</p>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Shop name</span>
                    <input
                      type="text"
                      value={shopNameInput}
                      onChange={(event) => setShopNameInput(event.target.value)}
                      maxLength={160}
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black/30"
                      placeholder="Enter shop name"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Logo URL (optional)</span>
                    <input
                      type="url"
                      value={shopLogoInput}
                      onChange={(event) => setShopLogoInput(event.target.value)}
                      maxLength={500}
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black/30"
                      placeholder="https://example.com/logo.png or /uploads/logo.png"
                    />
                  </label>
                  <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">Or upload logo file</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 block w-full text-sm text-black/80 file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-black/90"
                      onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUploadLogoFile}
                        disabled={isUploadingLogo || !logoFile}
                        className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold text-black transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUploadingLogo ? "Uploading..." : "Upload file"}
                      </button>
                      {logoFile ? <p className="text-xs text-black/60">Selected: {logoFile.name}</p> : null}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isRenamingShop}
                    className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRenamingShop ? "Saving..." : "Save changes"}
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
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
