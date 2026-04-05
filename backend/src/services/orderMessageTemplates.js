const formatStatus = (status) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const templates = {
  pending_payment: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} pending payment`,
    content:
      "We received your order and are waiting for payment confirmation.",
  }),
  pending: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} received`,
    content:
      "Thanks for your order! We have received it and will confirm payment shortly.",
  }),
  paid: (order) => ({
    subject: `Payment confirmed for order ${order.id.slice(0, 8)}`,
    content:
      "Your payment has been confirmed. We are preparing your items for processing.",
  }),
  processing: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} is being processed`,
    content:
      "Your order is now being processed. We will notify you when it is ready for delivery or pickup.",
  }),
  packed: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} packed`,
    content:
      "Your items have been packed and are ready to be handed to the delivery partner.",
  }),
  shipped: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} shipped`,
    content:
      "Great news! Your order has been shipped and is now in transit.",
  }),
  out_for_delivery: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} out for delivery`,
    content:
      "Your order is out for delivery and should arrive soon.",
  }),
  delivered: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} delivered`,
    content:
      "Your order was marked as delivered. Please confirm once you receive it.",
  }),
  received: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} received`,
    content:
      "Thanks for confirming receipt. We hope you enjoy your purchase.",
  }),
  delivery_failed: (order) => ({
    subject: `Delivery attempt failed for order ${order.id.slice(0, 8)}`,
    content:
      "We could not complete delivery on the first attempt. Our team will retry or contact you.",
  }),
  delivery_pickup: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} ready for delivery/pickup`,
    content:
      "Your order is ready for delivery or pickup. Please check your account for tracking or pickup details.",
  }),
  fulfilled: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} fulfilled`,
    content:
      "Your order has been completed. Thank you for shopping with us!",
  }),
  cancelled: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} cancelled`,
    content:
      "Your order has been cancelled. If this is unexpected, please contact support.",
  }),
  returned: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} returned`,
    content:
      "Your order has been marked as returned. We will review and process refund actions shortly.",
  }),
  refunded: (order) => ({
    subject: `Refund completed for order ${order.id.slice(0, 8)}`,
    content:
      "Your refund has been processed successfully.",
  }),
  fraud_hold: (order) => ({
    subject: `Order ${order.id.slice(0, 8)} under review`,
    content:
      "Your order is temporarily on hold while we complete security verification.",
  }),
};

const buildOrderStatusMessage = (status, order) => {
  const builder = templates[status];
  if (!builder) {
    return {
      subject: `Order ${order.id.slice(0, 8)} updated`,
      content: `Your order status is now ${formatStatus(status)}.`,
    };
  }

  return builder(order);
};

module.exports = {
  buildOrderStatusMessage,
};
