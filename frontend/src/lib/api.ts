import axios from "axios";

const resolveApiBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true, // Enable cookie handling for HTTP-only auth tokens
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const activeShopId = window.localStorage.getItem("ellora_active_shop_id");

    config.headers = config.headers ?? {};

    if (activeShopId) {
      config.headers["x-shop-id"] = activeShopId;
    }
  }
  return config;
});

export default api;
