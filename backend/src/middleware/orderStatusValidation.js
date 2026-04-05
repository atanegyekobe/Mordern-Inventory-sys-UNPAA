const { ORDER_STATUSES } = require("../services/orderLifecycle");

const validateOrderStatusPayload = (req, res, next) => {
  const nextStatus = req.body?.status;

  if (!nextStatus || typeof nextStatus !== "string") {
    return res.status(400).json({ message: "status is required." });
  }

  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ message: "Invalid status." });
  }

  return next();
};

module.exports = {
  validateOrderStatusPayload,
};
