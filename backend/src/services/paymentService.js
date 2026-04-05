const crypto = require("crypto");
const config = require("../config/env");

const PAYSTACK_API_BASE = config.paystackBaseUrl || "https://api.paystack.co";

const ensurePaystackConfigured = () => {
  if (!config.paystackSecretKey) {
    const error = new Error("Payment gateway is not configured.");
    error.status = 500;
    throw error;
  }
};

const requestPaystack = async (path, options = {}) => {
  ensurePaystackConfigured();

  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.paystackSecretKey}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json();

  if (!response.ok || payload.status === false) {
    const error = new Error(payload.message || "Payment provider request failed.");
    error.status = response.status || 502;
    error.details = payload;
    throw error;
  }

  return payload;
};

const toSmallestUnit = (amountMajor) => {
  const numeric = Number(amountMajor);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric * 100);
};

const initializePaystackTransaction = async ({
  email,
  amountMajor,
  reference,
  callbackUrl,
  currency = "GHS",
  metadata = {},
}) => {
  return requestPaystack("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: toSmallestUnit(amountMajor),
      reference,
      callback_url: callbackUrl,
      currency,
      metadata,
    },
  });
};

const verifyPaystackTransaction = async (reference) => {
  return requestPaystack(`/transaction/verify/${encodeURIComponent(reference)}`);
};

const createPaystackRefund = async ({
  transactionReference,
  amountMajor,
  currency = "GHS",
  reasonCode,
  internalNote,
  reasonNote,
}) => {
  const amountSmallestUnit = toSmallestUnit(amountMajor);
  if (!transactionReference || amountSmallestUnit <= 0) {
    const error = new Error("Invalid refund payload.");
    error.status = 400;
    throw error;
  }

  return requestPaystack("/refund", {
    method: "POST",
    body: {
      transaction: transactionReference,
      amount: amountSmallestUnit,
      currency,
      merchant_note: internalNote,
      customer_note: reasonNote || reasonCode,
    },
  });
};

const verifyPaystackWebhookSignature = (rawBody, signature) => {
  if (!signature || !rawBody || !config.paystackSecretKey) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", config.paystackSecretKey)
    .update(rawBody, "utf8")
    .digest("hex");

  return expected === signature;
};

module.exports = {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  createPaystackRefund,
  verifyPaystackWebhookSignature,
};
