const db = require("../config/database");
const { Order, OrderStatusEvent } = require("../models");
const { ORDER_STATUSES, STATUS_TRANSITIONS } = require("./orderLifecycle");

const allowedTransitions = STATUS_TRANSITIONS;

const STATUS_ALIASES = {
  pending: "pending_payment",
};

class OrderTransitionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "OrderTransitionError";
    this.details = details;
  }
}

const normalizeStatus = (status) => {
  if (!status || typeof status !== "string") {
    return null;
  }

  const normalized = status.trim().toLowerCase();
  return STATUS_ALIASES[normalized] || normalized;
};

const getAllowedNextStatuses = (currentStatus) => {
  const normalizedCurrent = normalizeStatus(currentStatus);
  if (!normalizedCurrent) {
    return [];
  }

  return allowedTransitions[normalizedCurrent] || [];
};

const validateOrderTransition = (currentStatus, nextStatus, actorRole = "admin") => {
  const normalizedCurrent = normalizeStatus(currentStatus);
  const normalizedNext = normalizeStatus(nextStatus);

  if (
    !normalizedCurrent ||
    !normalizedNext ||
    !ORDER_STATUSES.includes(normalizedCurrent) ||
    !ORDER_STATUSES.includes(normalizedNext)
  ) {
    throw new OrderTransitionError("Invalid order status.", {
      currentStatus,
      nextStatus,
    });
  }

  if (normalizedCurrent === normalizedNext) {
    throw new OrderTransitionError("Duplicate transition is not allowed.", {
      currentStatus,
      nextStatus,
    });
  }

  if (actorRole === "customer") {
    const isAllowedCustomerTransition =
      ["pending_payment", "pending"].includes(normalizedCurrent) &&
      normalizedNext === "cancelled";

    if (!isAllowedCustomerTransition) {
      throw new OrderTransitionError("Customers can only cancel pending orders.", {
        currentStatus,
        nextStatus,
        allowedNextStatuses: ["cancelled"],
      });
    }
  }

  const allowedNext = allowedTransitions[normalizedCurrent] || [];
  if (!allowedNext.includes(normalizedNext)) {
    throw new OrderTransitionError("Invalid status transition.", {
      currentStatus,
      nextStatus,
      allowedNextStatuses: allowedNext,
    });
  }

  return {
    normalizedCurrent,
    normalizedNext,
    persistedNextStatus: normalizedNext,
  };
};

const transitionOrderStatus = async ({
  orderId,
  nextStatus,
  actorRole,
  actorUserId,
  note = null,
  metadata = null,
  transaction: externalTransaction = null,
}) => {
  const runInTransaction = async (work) => {
    if (typeof db.transaction === "function") {
      return db.transaction(work);
    }

    return work({ LOCK: { UPDATE: "UPDATE" } });
  };

  const runTransition = async (transaction) => {
    const order = await Order.findByPk(orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw new OrderTransitionError("Order not found.");
    }

    const validation = validateOrderTransition(order.status, nextStatus, actorRole);
    const previousStatus = order.status;

    await order.update(
      {
        status: validation.persistedNextStatus,
      },
      { transaction }
    );

    await OrderStatusEvent.create({
      OrderId: order.id,
      fromStatus: previousStatus,
      toStatus: validation.persistedNextStatus,
      actorRole: actorRole || "system",
      actorUserId: actorUserId || null,
      note,
      metadata,
    });

    return order;
  };

  if (externalTransaction) {
    return runTransition(externalTransaction);
  }

  return runInTransaction(runTransition);
};

module.exports = {
  allowedTransitions,
  validateOrderTransition,
  getAllowedNextStatuses,
  transitionOrderStatus,
  OrderTransitionError,
};
