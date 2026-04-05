const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const aliasToCountry = {
  "north korea": "north korea",
  dprk: "north korea",
  prk: "north korea",
  kp: "north korea",
  iran: "iran",
  irn: "iran",
  ir: "iran",
  syria: "syria",
  sy: "syria",
  syr: "syria",
  russia: "russia",
  ru: "russia",
  rus: "russia",
  belarus: "belarus",
  by: "belarus",
  blr: "belarus",
};

const toSafeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const detectCountry = (address) => {
  const normalized = normalizeText(address);
  if (!normalized) return null;

  for (const [alias, country] of Object.entries(aliasToCountry)) {
    const pattern = new RegExp(`\\b${toSafeRegex(alias)}\\b`, "i");
    if (pattern.test(normalized)) {
      return country;
    }
  }

  return null;
};

const getHighRiskCountrySet = () => {
  const configured = process.env.FRAUD_HIGH_RISK_COUNTRIES;
  if (!configured) {
    return new Set(["north korea", "iran", "syria", "russia", "belarus"]);
  }

  return new Set(
    configured
      .split(",")
      .map((country) => normalizeText(country))
      .filter(Boolean)
  );
};

const evaluateOrderFraudRisk = ({
  shippingAddress,
  billingAddress,
  orderTotal,
  paymentFailedAttempts = 0,
  recentOrders = [],
}) => {
  const normalizedShipping = normalizeText(shippingAddress);
  const normalizedBilling = normalizeText(billingAddress);
  const highRiskCountries = getHighRiskCountrySet();

  const largePurchaseThreshold = toNumber(
    process.env.FRAUD_LARGE_PURCHASE_THRESHOLD,
    100000
  );
  const failedPaymentsThreshold = Math.max(
    1,
    toNumber(process.env.FRAUD_FAILED_PAYMENTS_THRESHOLD, 3)
  );

  const inferredFailedPayments = recentOrders.reduce((count, order) => {
    const metadata = order?.metadata || {};
    const failedViaMetadata =
      metadata?.payment?.lastAttemptStatus === "failed" ||
      metadata?.payment?.failed === true;

    if (failedViaMetadata) {
      return count + 1;
    }

    if (["pending_payment", "fraud_hold"].includes(order.status)) {
      return count + 1;
    }

    return count;
  }, 0);

  const totalFailedPayments =
    Math.max(0, toNumber(paymentFailedAttempts, 0)) + inferredFailedPayments;

  const signals = [];
  let score = 0;

  if (normalizedShipping && normalizedBilling && normalizedShipping !== normalizedBilling) {
    score += 30;
    signals.push({
      code: "address_mismatch",
      label: "Billing and shipping addresses differ",
      details: "Billing and shipping addresses do not match.",
      severity: "medium",
    });
  }

  if (totalFailedPayments >= failedPaymentsThreshold) {
    score += 35;
    signals.push({
      code: "failed_payments",
      label: "Multiple failed payment attempts",
      details: `${totalFailedPayments} payment failures detected in recent activity.`,
      severity: "high",
    });
  }

  const shippingCountry = detectCountry(shippingAddress);
  const billingCountry = detectCountry(billingAddress);
  const matchedRiskCountry =
    (shippingCountry && highRiskCountries.has(shippingCountry) && shippingCountry) ||
    (billingCountry && highRiskCountries.has(billingCountry) && billingCountry) ||
    null;

  if (matchedRiskCountry) {
    score += 40;
    signals.push({
      code: "high_risk_country",
      label: "High-risk country detected",
      details: `Order address includes ${matchedRiskCountry}.`,
      severity: "high",
    });
  }

  const totalValue = Math.max(0, toNumber(orderTotal, 0));
  if (totalValue >= largePurchaseThreshold) {
    score += 30;
    signals.push({
      code: "unusually_large_purchase",
      label: "Unusually large purchase",
      details: `Order value ${totalValue.toFixed(2)} exceeds threshold ${largePurchaseThreshold.toFixed(2)}.`,
      severity: "medium",
    });
  }

  const underReview = signals.length > 0;

  return {
    underReview,
    label: underReview ? "Under Review" : "Clear",
    score,
    signals,
    paymentFailuresDetected: totalFailedPayments,
    thresholds: {
      largePurchaseThreshold,
      failedPaymentsThreshold,
    },
    addresses: {
      shippingCountry,
      billingCountry,
      mismatch: normalizedShipping && normalizedBilling && normalizedShipping !== normalizedBilling,
    },
    evaluatedAt: new Date().toISOString(),
  };
};

module.exports = {
  evaluateOrderFraudRisk,
};
