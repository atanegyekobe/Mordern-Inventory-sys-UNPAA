import axios from "axios";

const resolveApiBaseUrl = () => {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    return isLocalhost ? "http://localhost:4000/api" : "/_/backend/api";
  }

  return process.env.NODE_ENV === "production"
    ? "/_/backend/api"
    : "http://localhost:4000/api";
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("ellora_token");
    const activeShopId = window.localStorage.getItem("ellora_active_shop_id");

    config.headers = config.headers ?? {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (activeShopId) {
      config.headers["x-shop-id"] = activeShopId;
    }
  }
  return config;
});

export default api;
