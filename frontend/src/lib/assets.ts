const fallbackApi = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

// If API base ends with /api, drop it for asset host fallback
const deriveAssetBase = (apiBase: string) => apiBase.replace(/\/api\/?$/, "");

export const assetBaseUrl =
  process.env.NEXT_PUBLIC_ASSET_BASE_URL || deriveAssetBase(fallbackApi);

export const toAssetUrl = (path?: string | null) => {
  if (!path) return "";

  // Already absolute
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedBase = assetBaseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};
