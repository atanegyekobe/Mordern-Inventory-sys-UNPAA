import api from "@/lib/api";

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Unable to start payment."
): string => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return fallback;
  }

  const data =
    (error as { response?: { data?: { message?: unknown; error?: unknown } } })
      .response?.data;

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (typeof data?.error === "string") {
    return data.error;
  }

  return fallback;
};

export const initializeOrderPayment = async (orderId: string): Promise<string> => {
  const response = await api.post("/payments/initialize", {
    orderId,
  });

  const authorizationUrl = response.data?.authorizationUrl;
  if (typeof authorizationUrl !== "string" || authorizationUrl.length === 0) {
    throw new Error("Payment provider did not return an authorization URL.");
  }

  return authorizationUrl;
};
