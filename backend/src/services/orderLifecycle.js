const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "received",
  "delivery_failed",
  "cancelled",
  "returned",
  "refunded",
  "fraud_hold",
  "pending",
  "delivery_pickup",
  "fulfilled",
];

const STATUS_TRANSITIONS = {
  pending_payment: ["paid", "cancelled", "fraud_hold"],
  paid: ["processing", "cancelled", "refunded", "fraud_hold"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivery_failed", "returned"],
  out_for_delivery: ["delivered", "delivery_failed", "returned"],
  delivered: ["received", "returned", "refunded"],
  received: ["returned", "refunded"],
  delivery_failed: ["out_for_delivery", "returned", "cancelled"],
  cancelled: ["refunded"],
  returned: ["refunded"],
  refunded: [],
  fraud_hold: ["paid", "cancelled"],
  pending: ["paid", "processing", "cancelled", "fraud_hold"],
  delivery_pickup: ["out_for_delivery", "delivered", "fulfilled"],
  fulfilled: ["received", "refunded"],
};

const ORDER_DASHBOARD_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "received",
  "delivery_failed",
  "cancelled",
  "returned",
  "refunded",
  "fraud_hold",
];

const getAllowedNextStatuses = (currentStatus) => {
  return STATUS_TRANSITIONS[currentStatus] || [];
};

const canTransitionOrderStatus = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) {
    return true;
  }
  return getAllowedNextStatuses(currentStatus).includes(nextStatus);
};

module.exports = {
  ORDER_STATUSES,
  ORDER_DASHBOARD_STATUSES,
  STATUS_TRANSITIONS,
  getAllowedNextStatuses,
  canTransitionOrderStatus,
};
