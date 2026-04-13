const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") ||
  "http://localhost:4000";

export const assetBaseUrl = BASE_URL;

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
