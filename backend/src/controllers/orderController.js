const {
  Order,
  OrderItem,
  Product,
  OrderNotification,
  OrderStatusEvent,
  User,
} = require("../models");
const db = require("../config/database");
const { Op } = require("sequelize");
const { buildOrderStatusMessage } = require("../services/orderMessageTemplates");
const { ORDER_STATUSES, ORDER_DASHBOARD_STATUSES } = require("../services/orderLifecycle");
const {
  transitionOrderStatus,
  validateOrderTransition,
  OrderTransitionError,
} = require("../services/orderStateMachineService");
const { verifyPaystackTransaction, createPaystackRefund } = require("../services/paymentService");
const {
  markPaymentSuccess,
  markPaymentVerificationState,
} = require("../services/paymentLifecycleService");
const {
  incrementMetric,
  logInfo,
  logWarn,
  logError,
} = require("../services/observabilityService");
const { rejectCrossShopAccess } = require("../middleware/shopContext");
const { majorToMinor, minorToMajor, ensureMinorInt } = require("../utils/money");

const USER_SAFE_ATTRIBUTES = ["id", "name", "email", "role"];
const DEFAULT_ORDER_PAGE_SIZE = 25;
const MAX_ORDER_PAGE_SIZE = 100;
const MIN_MANUAL_ACTION_NOTE_LENGTH = 10;
const MAX_MANUAL_ACTION_NOTE_LENGTH = 500;
const REFUND_REASON_CODES = [
  "customer_request",
  "product_defect",
  "wrong_item",
  "delivery_failure",
  "pricing_error",
  "duplicate_payment",
  "goodwill",
  "other",
];
const ADDRESS_LOCKED_STATUSES = new Set([
  "shipped",
  "out_for_delivery",
  "delivery_pickup",
  "delivered",
  "received",
  "delivery_failed",
  "returned",
  "refunded",
  "fulfilled",
]);
const VALID_ASSIGNMENT_PRIORITIES = ["low", "normal", "high", "urgent"];
const ADJUSTMENT_LOCKED_STATUSES = new Set([
  "packed",
  "shipped",
  "out_for_delivery",
  "delivery_pickup",
  "delivered",
  "received",
  "delivery_failed",
  "fulfilled",
  "cancelled",
  "returned",
  "refunded",
]);
const PAYMENT_CONTROLLED_STATUSES = new Set(["paid", "refunded"]);
const MAX_PAYMENT_AUDIT_ENTRIES = 100;
const OFFLINE_OVERRIDE_REFERENCE_LOOKBACK_DAYS = 180;
const MAX_OFFLINE_OVERRIDE_REFERENCE_SCAN = 1000;
const OFFLINE_OVERRIDE_REASON_CODES = [
  "offline_bank_transfer",
  "cash_settlement",
  "terminal_settlement",
  "executive_approval",
  "other",
];

const toDashboardStatus = (status) => {
  if (status === "pending") return "pending_payment";
  if (status === "delivery_pickup") return "out_for_delivery";
  if (status === "fulfilled") return "received";
  return status;
};

const parsePositiveInteger = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseDateInput = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const normalizeOptionalText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const normalizeBooleanInput = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return null;
};

const toCurrencyAmount = (value) => {
  // Safely parse and round currency value to major units
  // Avoids `.toFixed()` which converts to string
  const str = String(value ?? 0).trim();
  if (!/^[-+]?\d+(\.\d{0,})?$/.test(str)) {
    return null;
  }
  const parsed = Number(str);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  // Round to 2 decimal places without toFixed
  return Math.round(parsed * 100) / 100;
};

const toCurrencyMinor = (value) => {
  const majorAmount = toCurrencyAmount(value);
  if (majorAmount === null) {
    return null;
  }
  return ensureMinorInt(majorToMinor(majorAmount));
};

const appendPaymentAuditEntry = (payment = {}, entry) => {
  const existing = Array.isArray(payment.auditTrail) ? payment.auditTrail : [];
  return [...existing, entry].slice(-MAX_PAYMENT_AUDIT_ENTRIES);
};

const runInDbTransaction = async (work) => {
  if (typeof db.transaction === "function") {
    return db.transaction(work);
  }
  return work({ LOCK: { UPDATE: "UPDATE" } });
};

const recalculateOrderTotal = async (orderId, shopId) => {
  const items = await OrderItem.findAll({ where: { OrderId: orderId, ShopId: shopId } });
  const totalMinor = items.reduce((sum, item) => {
    const unitMinor = ensureMinorInt(item.unitPriceMinor || majorToMinor(item.unitPrice || 0));
    const lineTotalMinor = unitMinor * Number(item.quantity || 0);
    return sum + lineTotalMinor;
  }, 0);

  return {
    totalMinor,
    total: minorToMajor(totalMinor),
  };
};

const getPaymentOverrideApprovers = () => {
  const raw = process.env.PAYMENT_OVERRIDE_APPROVERS || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const isPaymentOverrideOperator = (user, approvers = []) => {
  const normalizedApprovers = approvers.map((value) => String(value).trim().toLowerCase());
  const candidates = [user?.email, user?.id]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim().toLowerCase());

  return candidates.some((candidate) => normalizedApprovers.includes(candidate));
};

const validateOfflineOverrideAuthorization = (user) => {
  const offlineOverrideEnabled =
    String(process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE || "").trim().toLowerCase() === "true";
  if (!offlineOverrideEnabled) {
    return {
      status: 403,
      message:
        "Offline payment overrides are disabled. Use gateway payment recheck for payment confirmation.",
    };
  }

  const approvers = getPaymentOverrideApprovers();
  if (approvers.length === 0) {
    return {
      status: 403,
      message: "Offline payment override approvers are not configured.",
    };
  }

  if (!isPaymentOverrideOperator(user, approvers)) {
    return {
      status: 403,
      message: "You are not authorized to manage offline payment overrides.",
    };
  }

  return null;
};

const findDuplicateOfflineApprovalReference = async ({ orderId, approvalReference, shopId }) => {
  if (!approvalReference) {
    return null;
  }

  const recentOrders =
    (await Order.findAll({
      where: {
        id: {
          [Op.ne]: orderId,
        },
        ShopId: shopId,
        updatedAt: {
          [Op.gte]: new Date(
            Date.now() - OFFLINE_OVERRIDE_REFERENCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      },
      attributes: ["id", "metadata", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: MAX_OFFLINE_OVERRIDE_REFERENCE_SCAN,
    })) || [];

  return (
    recentOrders.find((candidate) => {
      const payment = candidate?.metadata?.payment || {};
      const approvedReference = payment?.offlineOverride?.approvalReference;
      const pendingReference = payment?.pendingOfflineOverride?.approvalReference;
      return approvedReference === approvalReference || pendingReference === approvalReference;
    }) || null
  );
};

const readManualActionNote = (body = {}) => {
  const normalizedNote = normalizeOptionalText(body.internalNote) || normalizeOptionalText(body.note);

  if (!normalizedNote || normalizedNote.length < MIN_MANUAL_ACTION_NOTE_LENGTH) {
    return {
      note: null,
      error: `Internal note must be at least ${MIN_MANUAL_ACTION_NOTE_LENGTH} characters for manual admin actions.`,
    };
  }

  if (normalizedNote.length > MAX_MANUAL_ACTION_NOTE_LENGTH) {
    return {
      note: null,
      error: `Internal note cannot exceed ${MAX_MANUAL_ACTION_NOTE_LENGTH} characters.`,
    };
  }

  return { note: normalizedNote, error: null };
};

const list = async (req, res, next) => {
  try {
    const where = req.user.role === "admin"
      ? { ShopId: req.shopId }
      : { UserId: req.user.id, ShopId: req.shopId };
    const { status, userId, orderId, from, to } = req.query;

    if (typeof status === "string" && status.trim().length > 0) {
      where.status = status.trim();
    }

    if (req.user.role === "admin" && typeof userId === "string" && userId.trim().length > 0) {
      where.UserId = userId.trim();
    }

    if (typeof orderId === "string" && orderId.trim().length > 0) {
      where.id = {
        [Op.like]: `${orderId.trim()}%`,
      };
    }

    const fromDate = parseDateInput(from);
    const toDate = parseDateInput(to);

    if (from && !fromDate) {
      return res.status(400).json({ message: "Invalid 'from' date filter." });
    }

    if (to && !toDate) {
      return res.status(400).json({ message: "Invalid 'to' date filter." });
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt[Op.gte] = fromDate;
      }
      if (toDate) {
        where.createdAt[Op.lte] = toDate;
      }
    }

    const page = parsePositiveInteger(req.query.page);
    const limit = parsePositiveInteger(req.query.limit);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;

    const baseQuery = {
      where,
      include: [
        { model: User, attributes: USER_SAFE_ATTRIBUTES },
        { model: OrderItem, include: [{ model: Product }] },
        {
          model: OrderStatusEvent,
          attributes: ["id", "fromStatus", "toStatus", "actorRole", "note", "createdAt"],
          separate: true,
          order: [["createdAt", "DESC"]],
          limit: 10,
        },
      ],
      order: [["createdAt", "DESC"]],
    };

    if (shouldPaginate) {
      const safePage = page || 1;
      const safeLimit = Math.min(limit || DEFAULT_ORDER_PAGE_SIZE, MAX_ORDER_PAGE_SIZE);
      const offset = (safePage - 1) * safeLimit;

      const [total, orders] = await Promise.all([
        Order.count({ where }),
        Order.findAll({
          ...baseQuery,
          limit: safeLimit,
          offset,
        }),
      ]);

      return res.json({
        orders,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      });
    }

    const orders = await Order.findAll(baseQuery);
    return res.json({ orders });
  } catch (error) {
    return next(error);
  }
};

const dashboard = async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      where: { ShopId: req.shopId },
      attributes: ["id", "status", "total", "currency", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const highValueThreshold = 100000;
    const delayedShipmentDays = 5;
    const pendingRiskHours = 24;
    const refundWindowDays = 14;

    const statusCounts = ORDER_DASHBOARD_STATUSES.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    let totalOrdersToday = 0;
    let pendingFulfillment = 0;
    let delayedShipments = 0;
    let highValueOrders = 0;
    let riskFlaggedOrders = 0;
    let refundsAwaitingApproval = 0;

    for (const order of orders) {
      const createdAt = new Date(order.createdAt);
      const ageMs = now.getTime() - createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const ageHours = ageMs / (1000 * 60 * 60);
      const total = Number(order.total || 0);
      const dashboardStatus = toDashboardStatus(order.status);

      if (createdAt >= startOfToday) {
        totalOrdersToday += 1;
      }

      if (statusCounts[dashboardStatus] !== undefined) {
        statusCounts[dashboardStatus] += 1;
      }

      if (["paid", "processing", "packed", "shipped", "out_for_delivery", "delivery_pickup"].includes(order.status)) {
        pendingFulfillment += 1;
      }

      if (["shipped", "out_for_delivery", "delivery_pickup"].includes(order.status) && ageDays >= delayedShipmentDays) {
        delayedShipments += 1;
      }

      if (total >= highValueThreshold) {
        highValueOrders += 1;
      }

      if (
        (["pending_payment", "pending", "fraud_hold"].includes(order.status) &&
          ageHours >= pendingRiskHours &&
          total >= highValueThreshold) ||
        (order.status === "cancelled" && total >= highValueThreshold * 2)
      ) {
        riskFlaggedOrders += 1;
      }

      if (["cancelled", "returned"].includes(order.status) && ageDays <= refundWindowDays) {
        refundsAwaitingApproval += 1;
      }
    }

    return res.json({
      kpis: {
        totalOrdersToday,
        pendingFulfillment,
        delayedShipments,
        highValueOrders,
        riskFlaggedOrders,
        refundsAwaitingApproval,
      },
      statusCounts,
      thresholds: {
        highValueThreshold,
        delayedShipmentDays,
        pendingRiskHours,
        refundWindowDays,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, ShopId: req.shopId },
      include: [
        { model: User, attributes: USER_SAFE_ATTRIBUTES },
        { model: OrderItem, include: [{ model: Product }] },
        {
          model: OrderStatusEvent,
          attributes: ["id", "fromStatus", "toStatus", "actorRole", "note", "createdAt", "metadata"],
          separate: true,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (rejectCrossShopAccess(order.ShopId, req, res)) {
      return;
    }

    if (req.user.role !== "admin" && order.UserId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (rejectCrossShopAccess(order.ShopId, req, res)) {
      return;
    }

    if (req.user.role !== "admin" && order.UserId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    const nextStatus = req.body.status;
    const previousStatus = order.status;
    const isStatusChange = nextStatus !== previousStatus;

    if (isStatusChange) {
      const { note: internalNote, error: internalNoteError } = readManualActionNote(req.body);
      if (internalNoteError) {
        return res.status(400).json({ message: internalNoteError });
      }
      req.body.note = internalNote;
    }

    if (isStatusChange) {
      try {
        await transitionOrderStatus({
          orderId: order.id,
          nextStatus,
          actorRole: req.user?.role ?? "system",
          actorUserId: req.user?.id ?? null,
          note: req.body.note ?? null,
          metadata: req.body.metadata ?? null,
        });
      } catch (error) {
        if (error instanceof OrderTransitionError) {
          return res.status(400).json({
            message: error.message,
            currentStatus: previousStatus,
            nextStatus,
            ...(error.details || {}),
          });
        }
        throw error;
      }
    }

    if (typeof order.reload === "function") {
      await order.reload();
    }

    if (isStatusChange) {
      try {
        const template = buildOrderStatusMessage(nextStatus, order);
        await OrderNotification.create({
          status: nextStatus,
          subject: template.subject,
          content: template.content,
          UserId: order.UserId,
          OrderId: order.id,
        });
      } catch (messageError) {
        console.error("Failed to create order status message:", messageError);
      }
    }

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
};

const setAutomationOverride = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { preventAutoTransition, reason, category, internalNote, effectiveUntil } = req.body;
    const disablingAutomation = !!preventAutoTransition;

    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote({
      internalNote,
      note: req.body.note,
    });
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const normalizedReason = normalizeOptionalText(reason);
    const normalizedCategory = normalizeOptionalText(category);

    if (disablingAutomation && (!normalizedReason || normalizedReason.length < 10)) {
      return res.status(400).json({
        message: "A clear reason (minimum 10 characters) is required to disable automation.",
      });
    }

    let normalizedEffectiveUntil = null;
    if (effectiveUntil) {
      const parsedDate = new Date(effectiveUntil);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid effectiveUntil date." });
      }

      if (disablingAutomation && parsedDate.getTime() <= Date.now()) {
        return res.status(400).json({
          message: "effectiveUntil must be a future date when disabling automation.",
        });
      }

      normalizedEffectiveUntil = parsedDate.toISOString();
    }

    const currentMetadata = order.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      automationOverride: {
        preventAutoTransition: disablingAutomation,
        reason: disablingAutomation ? normalizedReason : null,
        category: disablingAutomation ? normalizedCategory : null,
        internalNote: normalizedManualNote,
        effectiveUntil: disablingAutomation ? normalizedEffectiveUntil : null,
        setBy: req.user.id,
        setAt: new Date().toISOString(),
      },
    };

    await order.update({ metadata: updatedMetadata });

    // Log this action in timeline
    await OrderStatusEvent.create({
      OrderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actorRole: "admin",
      actorUserId: req.user.id,
      note: normalizedManualNote,
      metadata: {
        action: disablingAutomation ? "automation_disabled" : "automation_enabled",
        reason: normalizedReason,
        automationOverride: updatedMetadata.automationOverride,
      },
    });

    return res.json({
      message: disablingAutomation ? "Automation disabled" : "Automation enabled",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

const recheckPayment = async (req, res, next) => {
  try {
    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote(req.body);
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const payment = order.metadata?.payment || {};
    const reference = payment.reference;

    if (payment.provider && payment.provider !== "paystack") {
      return res.status(400).json({
        message: `Unsupported payment provider '${payment.provider}' for manual recheck.`,
      });
    }

    if (!reference) {
      return res.status(400).json({
        message: "Payment reference missing for this order. Initialize payment first.",
      });
    }

    const verification = await verifyPaystackTransaction(reference);
    const gatewayData = verification.data || {};

    if (gatewayData.status === "success") {
      const settlement = await markPaymentSuccess({
        order,
        reference,
        gatewayData,
        actorRole: req.user?.role || "admin",
        actorUserId: req.user?.id || null,
        verificationSource: "admin_recheck",
        statusEventNote: `Payment manually rechecked by admin and confirmed via Paystack. Note: ${normalizedManualNote}`,
      });

      incrementMetric("payment.manual_recheck.success", 1);
      logInfo("payment.manual_recheck.success", {
        orderId: order.id,
        reference,
        alreadyPaid: settlement.alreadyPaid,
      });

      return res.json({
        message: settlement.alreadyPaid
          ? "Payment already confirmed previously; order state verified."
          : "Payment confirmed and order updated.",
        verified: true,
        alreadyPaid: settlement.alreadyPaid,
        order,
      });
    }

    await markPaymentVerificationState({
      order,
      reference,
      gatewayData,
      verificationSource: "admin_recheck",
      actorRole: req.user?.role || "admin",
      actorUserId: req.user?.id || null,
    });

    await OrderStatusEvent.create({
      OrderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actorRole: req.user?.role || "admin",
      actorUserId: req.user?.id || null,
      note: normalizedManualNote,
      metadata: {
        payment: {
          provider: "paystack",
          reference,
          status: gatewayData.status || "failed",
        },
        action: "manual_payment_recheck",
      },
    });

    incrementMetric("payment.manual_recheck.unresolved", 1, {
      status: gatewayData.status || "failed",
    });
    logWarn("payment.manual_recheck.unresolved", {
      orderId: order.id,
      reference,
      paymentStatus: gatewayData.status || "failed",
    });

    return res.json({
      message: "Payment rechecked; gateway still reports an unresolved status.",
      verified: false,
      paymentStatus: gatewayData.status || "failed",
      order,
    });
  } catch (error) {
    incrementMetric("payment.manual_recheck.errors", 1);
    logError(
      "payment.manual_recheck.error",
      {
        orderId: req.params.id,
      },
      error
    );
    return next(error);
  }
};

const setFraudReviewState = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const action = normalizeOptionalText(req.body.action);
    const supportedActions = ["hold", "release", "mark_reviewed"];
    if (!action || !supportedActions.includes(action)) {
      return res.status(400).json({
        message: "Invalid fraud review action.",
        supportedActions,
      });
    }

    const reason = normalizeOptionalText(req.body.reason);
    if (!reason || reason.length < 10) {
      return res.status(400).json({
        message: "A clear reason (minimum 10 characters) is required for fraud review actions.",
      });
    }

    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote(req.body);
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const currentMetadata = order.metadata || {};
    const currentFraudReview = currentMetadata.fraudReview || {};
    const previousStatus = order.status;
    let nextStatus = previousStatus;

    if (action === "hold" && previousStatus !== "fraud_hold") {
      try {
        validateOrderTransition(previousStatus, "fraud_hold", req.user?.role || "admin");
      } catch (error) {
        if (error instanceof OrderTransitionError) {
          return res.status(400).json({
            message: error.message,
            currentStatus: previousStatus,
            nextStatus: "fraud_hold",
            ...(error.details || {}),
          });
        }
        throw error;
      }

      nextStatus = "fraud_hold";
    }

    if (action === "release" && previousStatus === "fraud_hold") {
      const requestedReleaseStatus = normalizeOptionalText(req.body.releaseStatus) || "paid";
      if (!ORDER_STATUSES.includes(requestedReleaseStatus)) {
        return res.status(400).json({ message: "Invalid release status." });
      }

      try {
        validateOrderTransition(previousStatus, requestedReleaseStatus, req.user?.role || "admin");
      } catch (error) {
        if (error instanceof OrderTransitionError) {
          return res.status(400).json({
            message: error.message,
            currentStatus: previousStatus,
            nextStatus: requestedReleaseStatus,
            ...(error.details || {}),
          });
        }
        throw error;
      }

      nextStatus = requestedReleaseStatus;
    }

    const now = new Date().toISOString();
    const updatedFraudReview = {
      ...currentFraudReview,
      underReview: action === "hold",
      action,
      reason,
      internalNote: normalizedManualNote,
      reviewedStatus:
        action === "hold" ? "held" : action === "release" ? "released" : "reviewed",
      releaseStatus: action === "release" ? nextStatus : null,
      reviewedBy: req.user.id,
      reviewedAt: now,
      updatedBy: req.user.id,
      updatedAt: now,
    };

    const updatedMetadata = {
      ...currentMetadata,
      fraudReview: updatedFraudReview,
    };

    await runInDbTransaction(async (transaction) => {
      await order.update(
        {
          metadata: updatedMetadata,
        },
        { transaction }
      );

      if (nextStatus !== previousStatus) {
        await transitionOrderStatus({
          orderId: order.id,
          nextStatus,
          actorRole: req.user?.role || "admin",
          actorUserId: req.user?.id || null,
          note: normalizedManualNote,
          metadata: {
            action: `fraud_review_${action}`,
            reason,
            fraudReview: updatedFraudReview,
          },
          transaction,
        });
      } else {
        await OrderStatusEvent.create(
          {
            OrderId: order.id,
            fromStatus: previousStatus,
            toStatus: nextStatus,
            actorRole: req.user?.role || "admin",
            actorUserId: req.user?.id || null,
            note: normalizedManualNote,
            metadata: {
              action: `fraud_review_${action}`,
              reason,
              fraudReview: updatedFraudReview,
            },
          },
          { transaction }
        );
      }
    });

    if (typeof order.reload === "function") {
      await order.reload();
    }

    if (nextStatus !== previousStatus) {
      try {
        const template = buildOrderStatusMessage(nextStatus, order);
        await OrderNotification.create({
          status: nextStatus,
          subject: template.subject,
          content: template.content,
          UserId: order.UserId,
          OrderId: order.id,
        });
      } catch (messageError) {
        console.error("Failed to create order status message:", messageError);
      }
    }

    return res.json({
      message:
        action === "hold"
          ? "Order placed under fraud review."
          : action === "release"
            ? "Fraud review released."
            : "Fraud review marked as reviewed.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

const setOperationalData = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote(req.body);
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const currentMetadata = order.metadata || {};
    const currentOperational = currentMetadata.operational || {};
    const currentShippingData = currentOperational.shippingData || {};
    const currentContact = currentOperational.contact || {};
    const currentAssignment = currentOperational.assignment || {};

    const nextShippingData = { ...currentShippingData };
    const nextContact = { ...currentContact };
    const nextAssignment = { ...currentAssignment };

    const updatedSections = [];

    const carrier = normalizeOptionalText(req.body.carrier);
    const trackingNumber = normalizeOptionalText(req.body.trackingNumber);
    const customerPhone = normalizeOptionalText(req.body.customerPhone);
    const deliveryInstructions = normalizeOptionalText(req.body.deliveryInstructions);
    const assignmentOwner = normalizeOptionalText(req.body.assignmentOwner);
    const assignmentPriority = normalizeOptionalText(req.body.assignmentPriority);

    if (hasOwn(req.body, "carrier")) {
      nextShippingData.carrier = carrier;
      if (!updatedSections.includes("shipping_data")) {
        updatedSections.push("shipping_data");
      }
    }

    if (hasOwn(req.body, "trackingNumber")) {
      nextShippingData.trackingNumber = trackingNumber;
      if (!updatedSections.includes("shipping_data")) {
        updatedSections.push("shipping_data");
      }
    }

    if (hasOwn(req.body, "shipDate")) {
      if (!req.body.shipDate) {
        nextShippingData.shipDate = null;
      } else {
        const parsedShipDate = parseDateInput(req.body.shipDate);
        if (!parsedShipDate) {
          return res.status(400).json({ message: "Invalid shipDate value." });
        }
        nextShippingData.shipDate = parsedShipDate.toISOString();
      }

      if (!updatedSections.includes("shipping_data")) {
        updatedSections.push("shipping_data");
      }
    }

    if (hasOwn(req.body, "deliveryEta")) {
      if (!req.body.deliveryEta) {
        nextShippingData.deliveryEta = null;
      } else {
        const parsedEta = parseDateInput(req.body.deliveryEta);
        if (!parsedEta) {
          return res.status(400).json({ message: "Invalid deliveryEta value." });
        }
        nextShippingData.deliveryEta = parsedEta.toISOString();
      }

      if (!updatedSections.includes("shipping_data")) {
        updatedSections.push("shipping_data");
      }
    }

    if (nextShippingData.shipDate && nextShippingData.deliveryEta) {
      const shipDateMs = new Date(nextShippingData.shipDate).getTime();
      const deliveryEtaMs = new Date(nextShippingData.deliveryEta).getTime();
      if (deliveryEtaMs < shipDateMs) {
        return res.status(400).json({ message: "deliveryEta must be later than shipDate." });
      }
    }

    if (hasOwn(req.body, "customerPhone")) {
      nextContact.phone = customerPhone;
      if (!updatedSections.includes("contact")) {
        updatedSections.push("contact");
      }
    }

    if (hasOwn(req.body, "deliveryInstructions")) {
      nextContact.deliveryInstructions = deliveryInstructions;
      if (!updatedSections.includes("contact")) {
        updatedSections.push("contact");
      }
    }

    if (hasOwn(req.body, "assignmentOwner")) {
      nextAssignment.owner = assignmentOwner;
      if (!updatedSections.includes("assignment")) {
        updatedSections.push("assignment");
      }
    }

    if (hasOwn(req.body, "assignmentPriority")) {
      if (assignmentPriority && !VALID_ASSIGNMENT_PRIORITIES.includes(assignmentPriority)) {
        return res.status(400).json({
          message: "Invalid assignment priority.",
          validPriorities: VALID_ASSIGNMENT_PRIORITIES,
        });
      }
      nextAssignment.priority = assignmentPriority || "normal";
      if (!updatedSections.includes("assignment")) {
        updatedSections.push("assignment");
      }
    }

    if (hasOwn(req.body, "escalationFlag")) {
      const normalizedEscalationFlag = normalizeBooleanInput(req.body.escalationFlag);
      if (normalizedEscalationFlag === null) {
        return res.status(400).json({ message: "Invalid escalationFlag value." });
      }
      nextAssignment.escalationFlag = normalizedEscalationFlag;
      if (!updatedSections.includes("assignment")) {
        updatedSections.push("assignment");
      }
    }

    let nextShippingAddress = order.shippingAddress;
    let nextBillingAddress = order.billingAddress;
    let hasAddressChange = false;

    if (hasOwn(req.body, "shippingAddress")) {
      const normalizedShippingAddress =
        req.body.shippingAddress === null ? null : normalizeOptionalText(req.body.shippingAddress);
      if ((normalizedShippingAddress || null) !== (order.shippingAddress || null)) {
        hasAddressChange = true;
      }
      nextShippingAddress = normalizedShippingAddress;
    }

    if (hasOwn(req.body, "billingAddress")) {
      const normalizedBillingAddress =
        req.body.billingAddress === null ? null : normalizeOptionalText(req.body.billingAddress);
      if ((normalizedBillingAddress || null) !== (order.billingAddress || null)) {
        hasAddressChange = true;
      }
      nextBillingAddress = normalizedBillingAddress;
    }

    let addressCorrectionMetadata = currentOperational.addressCorrection || null;
    if (hasAddressChange) {
      if (ADDRESS_LOCKED_STATUSES.has(order.status)) {
        return res.status(400).json({
          message: "Shipping and billing addresses are locked after the order reaches shipped state.",
        });
      }

      const addressCorrectionReason = normalizeOptionalText(req.body.addressCorrectionReason);
      if (!addressCorrectionReason || addressCorrectionReason.length < 10) {
        return res.status(400).json({
          message:
            "Address correction reason is required (minimum 10 characters) before updating shipping or billing address.",
        });
      }

      const nowIso = new Date().toISOString();
      addressCorrectionMetadata = {
        reason: addressCorrectionReason,
        correctedBy: req.user.id,
        correctedAt: nowIso,
      };

      updatedSections.push("address_correction");
    }

    if (updatedSections.length === 0) {
      return res.status(400).json({ message: "No operational updates provided." });
    }

    const nowIso = new Date().toISOString();
    const updatedMetadata = {
      ...currentMetadata,
      operational: {
        ...currentOperational,
        shippingData: {
          carrier: nextShippingData.carrier || null,
          trackingNumber: nextShippingData.trackingNumber || null,
          shipDate: nextShippingData.shipDate || null,
          deliveryEta: nextShippingData.deliveryEta || null,
        },
        contact: {
          phone: nextContact.phone || null,
          deliveryInstructions: nextContact.deliveryInstructions || null,
        },
        assignment: {
          owner: nextAssignment.owner || null,
          priority: nextAssignment.priority || "normal",
          escalationFlag: !!nextAssignment.escalationFlag,
        },
        addressCorrection: addressCorrectionMetadata,
        updatedBy: req.user.id,
        updatedAt: nowIso,
      },
    };

    await order.update({
      metadata: updatedMetadata,
      shippingAddress: nextShippingAddress,
      billingAddress: nextBillingAddress,
    });

    await OrderStatusEvent.create({
      OrderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actorRole: req.user?.role || "admin",
      actorUserId: req.user?.id || null,
      note: normalizedManualNote,
      metadata: {
        action: "operational_data_updated",
        sections: updatedSections,
        operational: updatedMetadata.operational,
      },
    });

    return res.json({
      message: "Operational order data updated.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

const createRefund = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote(req.body);
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const paymentStatus = order.metadata?.payment?.status;
    if (paymentStatus !== "success") {
      return res.status(400).json({
        message: "Refund actions require a settled payment.",
      });
    }

    const refundType = normalizeOptionalText(req.body.refundType);
    if (!refundType || !["full", "partial"].includes(refundType)) {
      return res.status(400).json({ message: "Invalid refund type. Use 'full' or 'partial'." });
    }

    const reasonCode = normalizeOptionalText(req.body.reasonCode);
    if (!reasonCode || !REFUND_REASON_CODES.includes(reasonCode)) {
      return res.status(400).json({
        message: "Invalid refund reason code.",
        reasonCodes: REFUND_REASON_CODES,
      });
    }

    const reasonNote = normalizeOptionalText(req.body.reasonNote);
    const orderTotalMinor = ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0));
    if (orderTotalMinor <= 0) {
      return res.status(400).json({ message: "Order total is invalid for refund processing." });
    }

    const currentMetadata = order.metadata || {};
    const currentRefunds = Array.isArray(currentMetadata.refunds) ? currentMetadata.refunds : [];
    const previousRefundedAmountMinor = ensureMinorInt(
      currentMetadata.payment?.refundedAmountMinor ||
        majorToMinor(currentMetadata.payment?.refundedAmount || 0)
    );
    const remainingRefundableAmountMinor = Math.max(
      orderTotalMinor - previousRefundedAmountMinor,
      0
    );

    if (remainingRefundableAmountMinor <= 0) {
      return res.status(400).json({
        message: "Order has already been fully refunded.",
      });
    }

    let refundAmountMinor = remainingRefundableAmountMinor;
    if (refundType === "partial") {
      const parsedAmountMinor = toCurrencyMinor(req.body.amount);
      if (parsedAmountMinor === null || parsedAmountMinor <= 0) {
        return res.status(400).json({ message: "Partial refund requires a valid positive amount." });
      }

      if (parsedAmountMinor >= remainingRefundableAmountMinor) {
        return res.status(400).json({
          message: "Partial refund amount must be less than the remaining refundable amount. Use full refund instead.",
        });
      }

      refundAmountMinor = parsedAmountMinor;
    }

    const nextRefundedAmountMinor = previousRefundedAmountMinor + refundAmountMinor;

    if (nextRefundedAmountMinor > orderTotalMinor) {
      return res.status(400).json({
        message: "Refund amount exceeds total paid amount for this order.",
      });
    }

    const nowIso = new Date().toISOString();
    const paymentProvider = normalizeOptionalText(currentMetadata.payment?.provider || "") || "paystack";
    const paymentReference = normalizeOptionalText(currentMetadata.payment?.reference || "");

    let gatewayRefund = null;
    if (paymentProvider === "paystack") {
      if (!paymentReference) {
        return res.status(400).json({
          message: "Cannot process gateway refund without payment reference.",
        });
      }

      const gatewayResponse = await createPaystackRefund({
        transactionReference: paymentReference,
        amountMajor: minorToMajor(refundAmountMinor),
        currency: order.currency || "GHS",
        reasonCode,
        internalNote: normalizedManualNote,
        reasonNote,
      });

      gatewayRefund = {
        provider: "paystack",
        status: gatewayResponse?.data?.status || "pending",
        gatewayReference:
          gatewayResponse?.data?.transaction_reference ||
          gatewayResponse?.data?.id ||
          gatewayResponse?.data?.reference ||
          null,
        refundedAt: nowIso,
      };
    }

    const refundRecord = {
      id: `refund_${Date.now()}`,
      type: refundType,
      amount: minorToMajor(refundAmountMinor),
      amountMinor: refundAmountMinor,
      currency: order.currency || "GHS",
      reasonCode,
      reasonNote,
      internalNote: normalizedManualNote,
      processedBy: req.user.id,
      processedAt: nowIso,
      gateway: gatewayRefund,
    };

    const nextStatus = refundType === "full" ? "refunded" : order.status;
    if (refundType === "full") {
      try {
        validateOrderTransition(order.status, nextStatus, req.user?.role || "admin");
      } catch (error) {
        if (error instanceof OrderTransitionError) {
          return res.status(400).json({
            message: error.message,
            currentStatus: order.status,
            nextStatus,
            ...(error.details || {}),
          });
        }
        throw error;
      }
    }

    const updatedMetadata = {
      ...currentMetadata,
      payment: {
        ...(currentMetadata.payment || {}),
        refundStatus:
          refundType === "full"
            ? "full_refund_processed"
            : nextRefundedAmountMinor >= orderTotalMinor
              ? "full_refund_processed"
              : "partial_refund_processed",
        refundedAmount: minorToMajor(nextRefundedAmountMinor),
        refundedAmountMinor: nextRefundedAmountMinor,
        refundedAt: nowIso,
        auditTrail: appendPaymentAuditEntry(currentMetadata.payment || {}, {
          action: "refund_processed",
          source: paymentProvider === "paystack" ? "gateway_refund" : "manual_refund",
          actorRole: req.user?.role || "admin",
          actorUserId: req.user?.id || null,
          status: "success",
          reference: paymentReference || null,
          refundType,
          amount: minorToMajor(refundAmountMinor),
          amountMinor: refundAmountMinor,
          currency: order.currency || "GHS",
          reasonCode,
          note: normalizedManualNote,
          gatewayStatus: gatewayRefund?.status || null,
          timestamp: nowIso,
        }),
      },
      refunds: [...currentRefunds, refundRecord],
    };

    const previousStatus = order.status;
    await runInDbTransaction(async (transaction) => {
      // Refunds do not modify totalPaid (payment amount already recorded at settlement)
      // Refund amounts are tracked separately in metadata.payment.refundedAmountMinor
      // Only update metadata and status; keep financial totals unchanged
      const updateFields = {
        metadata: updatedMetadata,
      };
      // Ensure balanceDue is 0 for fully paid orders (should already be 0)
      if (order.balanceDue > 0) {
        updateFields.balanceDue = 0;
      }
      await order.update(updateFields, { transaction });

      if (nextStatus !== previousStatus) {
        await transitionOrderStatus({
          orderId: order.id,
          nextStatus,
          actorRole: req.user?.role || "admin",
          actorUserId: req.user?.id || null,
          note: normalizedManualNote,
          metadata: {
            action: refundType === "full" ? "refund_full" : "refund_partial",
            refund: refundRecord,
          },
          transaction,
        });
      } else {
        await OrderStatusEvent.create(
          {
            OrderId: order.id,
            fromStatus: previousStatus,
            toStatus: nextStatus,
            actorRole: req.user?.role || "admin",
            actorUserId: req.user?.id || null,
            note: normalizedManualNote,
            metadata: {
              action: "refund_partial",
              refund: refundRecord,
            },
          },
          { transaction }
        );
      }
    });

    if (typeof order.reload === "function") {
      await order.reload();
    }

    if (nextStatus !== previousStatus) {
      try {
        const template = buildOrderStatusMessage(nextStatus, order);
        await OrderNotification.create({
          status: nextStatus,
          subject: template.subject,
          content: template.content,
          UserId: order.UserId,
          OrderId: order.id,
        });
      } catch (messageError) {
        console.error("Failed to create order status message:", messageError);
      }
    }

    return res.json({
      message: refundType === "full" ? "Full refund processed." : "Partial refund processed.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

const adjustOrderItems = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (ADJUSTMENT_LOCKED_STATUSES.has(order.status)) {
      return res.status(400).json({
        message: "Order item adjustments are only allowed before fulfillment starts.",
      });
    }

    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote(req.body);
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const action = normalizeOptionalText(req.body.action);
    if (!action || !["add", "remove"].includes(action)) {
      return res.status(400).json({ message: "Invalid adjustment action. Use 'add' or 'remove'." });
    }

    let adjustmentMetadata = null;

    if (action === "add") {
      const productId = normalizeOptionalText(req.body.productId);
      if (!productId) {
        return res.status(400).json({ message: "productId is required when adding a line item." });
      }

      const quantity = Number.parseInt(req.body.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: "Quantity must be a positive integer." });
      }

      const product = await Product.findOne({ where: { id: productId, ShopId: req.shopId } });
      if (!product) {
        return res.status(404).json({ message: "Product not found." });
      }

      const requestedUnitPrice = req.body.unitPrice !== undefined ? toCurrencyAmount(req.body.unitPrice) : null;
      if (req.body.unitPrice !== undefined && (requestedUnitPrice === null || requestedUnitPrice <= 0)) {
        return res.status(400).json({ message: "unitPrice must be a positive number when provided." });
      }

      const fallbackProductPrice = toCurrencyAmount(product.price);
      if (fallbackProductPrice === null || fallbackProductPrice <= 0) {
        return res.status(400).json({ message: "Product price is invalid for adjustment." });
      }

      const unitPrice = requestedUnitPrice || fallbackProductPrice;
      const unitPriceMinor = majorToMinor(unitPrice);
      const costAtPurchase = ensureMinorInt(product.costMinor || majorToMinor(product.cost || 0));
      const createdItem = await OrderItem.create({
        ShopId: req.shopId,
        OrderId: order.id,
        ProductId: product.id,
        quantity,
        unitPrice: minorToMajor(unitPriceMinor),
        unitPriceMinor,
        priceAtPurchase: unitPriceMinor,
        costAtPurchase,
      });

      adjustmentMetadata = {
        action,
        item: {
          id: createdItem.id,
          ProductId: product.id,
          quantity,
          unitPrice: minorToMajor(unitPriceMinor),
          unitPriceMinor,
        },
      };
    }

    if (action === "remove") {
      const orderItemId = normalizeOptionalText(req.body.orderItemId);
      if (!orderItemId) {
        return res.status(400).json({ message: "orderItemId is required when removing a line item." });
      }

      const targetItem = await OrderItem.findOne({
        where: {
          id: orderItemId,
          OrderId: order.id,
          ShopId: req.shopId,
        },
      });
      if (!targetItem) {
        return res.status(404).json({ message: "Order item not found." });
      }

      await targetItem.destroy();
      adjustmentMetadata = {
        action,
        item: {
          id: targetItem.id,
          ProductId: targetItem.ProductId,
          quantity: targetItem.quantity,
          unitPrice: targetItem.unitPrice,
        },
      };
    }

    const nextTotals = await recalculateOrderTotal(order.id, req.shopId);
    const currentMetadata = order.metadata || {};
    const currentAdjustments = Array.isArray(currentMetadata.adjustments)
      ? currentMetadata.adjustments
      : [];

    await order.update({
      total: nextTotals.total,
      totalMinor: nextTotals.totalMinor,
      balanceDue: Math.max(nextTotals.totalMinor - ensureMinorInt(order.totalPaid || 0), 0),
      metadata: {
        ...currentMetadata,
        adjustments: [
          ...currentAdjustments,
          {
            ...adjustmentMetadata,
            internalNote: normalizedManualNote,
            changedBy: req.user.id,
            changedAt: new Date().toISOString(),
          },
        ],
      },
    });

    await OrderStatusEvent.create({
      OrderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actorRole: req.user?.role || "admin",
      actorUserId: req.user?.id || null,
      note: normalizedManualNote,
      metadata: {
        action: action === "add" ? "order_item_added" : "order_item_removed",
        adjustment: adjustmentMetadata,
        recalculatedTotal: nextTotals.total,
        recalculatedTotalMinor: nextTotals.totalMinor,
      },
    });

    return res.json({
      message: action === "add" ? "Line item added." : "Line item removed.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

const applyOfflinePaymentOverride = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const authorizationError = validateOfflineOverrideAuthorization(req.user);
    if (authorizationError) {
      return res.status(authorizationError.status).json({
        message: authorizationError.message,
      });
    }

    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote(req.body);
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const reasonCode = normalizeOptionalText(req.body.reasonCode);
    if (!reasonCode || !OFFLINE_OVERRIDE_REASON_CODES.includes(reasonCode)) {
      return res.status(400).json({
        message: "Invalid payment override reason code.",
        reasonCodes: OFFLINE_OVERRIDE_REASON_CODES,
      });
    }

    const approvalReference = normalizeOptionalText(req.body.approvalReference);
    if (!approvalReference || approvalReference.length < 6) {
      return res.status(400).json({
        message: "approvalReference is required for offline settlement override.",
      });
    }

    const orderTotalMinor = ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0));
    if (orderTotalMinor <= 0) {
      return res.status(400).json({ message: "Order total is invalid for payment override." });
    }

    const amountMinor = req.body.amount !== undefined ? toCurrencyMinor(req.body.amount) : orderTotalMinor;
    if (amountMinor === null || amountMinor <= 0 || amountMinor !== orderTotalMinor) {
      return res.status(400).json({
        message: "Offline settlement amount must match full order total.",
      });
    }

    const currentMetadata = order.metadata || {};
    const currentPayment = currentMetadata.payment || {};

    if (currentPayment.pendingOfflineOverride?.approvalReference) {
      return res.status(409).json({
        message:
          "This order already has a pending offline payment override request awaiting second approval.",
      });
    }

    const duplicateApprovalOrder = await findDuplicateOfflineApprovalReference({
      orderId: order.id,
      approvalReference,
      shopId: req.shopId,
    });
    if (duplicateApprovalOrder) {
      return res.status(409).json({
        message:
          "approvalReference has already been used for another offline override. Provide a unique finance approval reference.",
      });
    }

    if (currentPayment.provider && currentPayment.provider !== "offline") {
      return res.status(400).json({
        message: "Offline payment override can only be used for offline payment records.",
      });
    }

    if (currentPayment.status === "success") {
      return res.status(400).json({ message: "Order payment is already settled." });
    }

    const nowIso = new Date().toISOString();
    const pendingOverride = {
      reasonCode,
      approvalReference,
      amount: minorToMajor(amountMinor),
      amountMinor,
      requestedBy: req.user.id,
      requestedEmail: req.user.email,
      requestedAt: nowIso,
      internalNote: normalizedManualNote,
    };

    const updatedMetadata = {
      ...currentMetadata,
      payment: {
        ...currentPayment,
        provider: "offline",
        pendingOfflineOverride: pendingOverride,
        auditTrail: appendPaymentAuditEntry(currentPayment, {
          action: "offline_override_requested",
          source: "offline_override_request",
          actorRole: req.user?.role || "admin",
          actorUserId: req.user?.id || null,
          status: currentPayment.status || "pending",
          reference: currentPayment.reference || null,
          amount: minorToMajor(amountMinor),
          amountMinor,
          currency: order.currency || "GHS",
          reasonCode,
          approvalReference,
          note: normalizedManualNote,
          gatewayStatus: "offline_approved_settlement",
          timestamp: nowIso,
        }),
      },
    };

    await order.update({
      metadata: updatedMetadata,
    });

    await OrderStatusEvent.create({
      OrderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actorRole: req.user?.role || "admin",
      actorUserId: req.user?.id || null,
      note: normalizedManualNote,
      metadata: {
        action: "offline_payment_override_requested",
        overrideRequest: pendingOverride,
      },
    });

    return res.json({
      message: "Offline payment override request submitted for second approval.",
      pendingApproval: true,
      order,
    });
  } catch (error) {
    return next(error);
  }
};

const approveOfflinePaymentOverride = async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const authorizationError = validateOfflineOverrideAuthorization(req.user);
    if (authorizationError) {
      return res.status(authorizationError.status).json({
        message: authorizationError.message,
      });
    }

    const { note: normalizedManualNote, error: manualNoteError } = readManualActionNote(req.body);
    if (manualNoteError) {
      return res.status(400).json({ message: manualNoteError });
    }

    const currentMetadata = order.metadata || {};
    const currentPayment = currentMetadata.payment || {};
    const pendingOverride = currentPayment.pendingOfflineOverride || null;

    if (!pendingOverride) {
      return res.status(400).json({
        message: "No pending offline payment override request exists for this order.",
      });
    }

    const requesterMatchesActor =
      (pendingOverride.requestedBy && pendingOverride.requestedBy === req.user.id) ||
      (pendingOverride.requestedEmail && pendingOverride.requestedEmail === req.user.email);
    if (requesterMatchesActor) {
      return res.status(403).json({
        message: "Maker-checker control requires a different admin to approve this override.",
      });
    }

    const reasonCode = normalizeOptionalText(pendingOverride.reasonCode);
    if (!reasonCode || !OFFLINE_OVERRIDE_REASON_CODES.includes(reasonCode)) {
      return res.status(400).json({
        message: "Pending offline override request is invalid (reason code).",
      });
    }

    const approvalReference = normalizeOptionalText(pendingOverride.approvalReference);
    if (!approvalReference || approvalReference.length < 6) {
      return res.status(400).json({
        message: "Pending offline override request is invalid (approval reference).",
      });
    }

    if (currentPayment.provider && currentPayment.provider !== "offline") {
      return res.status(400).json({
        message: "Offline payment override can only be used for offline payment records.",
      });
    }

    if (currentPayment.status === "success") {
      return res.status(400).json({ message: "Order payment is already settled." });
    }

    const orderTotalMinor = ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0));
    if (orderTotalMinor <= 0) {
      return res.status(400).json({ message: "Order total is invalid for payment override." });
    }

    const amountMinor = ensureMinorInt(
      pendingOverride.amountMinor || majorToMinor(pendingOverride.amount)
    );
    if (amountMinor <= 0 || amountMinor !== orderTotalMinor) {
      return res.status(400).json({
        message: "Pending offline override amount is invalid for this order total.",
      });
    }

    const duplicateApprovalOrder = await findDuplicateOfflineApprovalReference({
      orderId: order.id,
      approvalReference,
      shopId: req.shopId,
    });
    if (duplicateApprovalOrder) {
      return res.status(409).json({
        message:
          "approvalReference has already been used for another offline override. Provide a unique finance approval reference.",
      });
    }

    const nowIso = new Date().toISOString();
    const offlineReference = `offline-${order.id.slice(0, 8)}-${Date.now()}`;
    const previousStatus = order.status;
    let nextStatus = previousStatus;
    if (["pending_payment", "pending"].includes(previousStatus)) {
      nextStatus = "paid";
    }

    const finalizedOverride = {
      reasonCode,
      approvalReference,
      amount: minorToMajor(amountMinor),
      amountMinor,
      requestedBy: pendingOverride.requestedBy || null,
      requestedEmail: pendingOverride.requestedEmail || null,
      requestedAt: pendingOverride.requestedAt || null,
      requestInternalNote: pendingOverride.internalNote || null,
      approvedBy: req.user.id,
      approvedEmail: req.user.email,
      approvedAt: nowIso,
      internalNote: normalizedManualNote,
    };

    const updatedMetadata = {
      ...currentMetadata,
      payment: {
        ...currentPayment,
        provider: "offline",
        status: "success",
        reference: offlineReference,
        paidAt: nowIso,
        verifiedAt: nowIso,
        verificationSource: "offline_override",
        verificationActorRole: req.user?.role || "admin",
        verificationActorUserId: req.user?.id || null,
        gatewayStatus: "offline_approved_settlement",
        pendingOfflineOverride: null,
        offlineOverride: finalizedOverride,
        auditTrail: appendPaymentAuditEntry(currentPayment, {
          action: "offline_override_approved",
          source: "offline_override",
          actorRole: req.user?.role || "admin",
          actorUserId: req.user?.id || null,
          status: "success",
          reference: offlineReference,
          amount: minorToMajor(amountMinor),
          amountMinor,
          currency: order.currency || "GHS",
          reasonCode,
          approvalReference,
          note: normalizedManualNote,
          gatewayStatus: "offline_approved_settlement",
          timestamp: nowIso,
        }),
      },
    };

    if (nextStatus !== previousStatus) {
      try {
        validateOrderTransition(previousStatus, nextStatus, req.user?.role || "admin");
      } catch (error) {
        if (error instanceof OrderTransitionError) {
          return res.status(400).json({
            message: error.message,
            currentStatus: previousStatus,
            nextStatus,
            ...(error.details || {}),
          });
        }
        throw error;
      }
    }

    await runInDbTransaction(async (transaction) => {
      await order.update(
        {
          metadata: updatedMetadata,
        },
        { transaction }
      );

      if (nextStatus !== previousStatus) {
        await transitionOrderStatus({
          orderId: order.id,
          nextStatus,
          actorRole: req.user?.role || "admin",
          actorUserId: req.user?.id || null,
          note: normalizedManualNote,
          metadata: {
            action: "offline_payment_override_approved",
            override: finalizedOverride,
          },
          transaction,
        });
      } else {
        await OrderStatusEvent.create(
          {
            OrderId: order.id,
            fromStatus: previousStatus,
            toStatus: nextStatus,
            actorRole: req.user?.role || "admin",
            actorUserId: req.user?.id || null,
            note: normalizedManualNote,
            metadata: {
              action: "offline_payment_override_approved",
              override: finalizedOverride,
            },
          },
          { transaction }
        );
      }
    });

    if (typeof order.reload === "function") {
      await order.reload();
    }

    if (nextStatus !== previousStatus) {
      try {
        const template = buildOrderStatusMessage(nextStatus, order);
        await OrderNotification.create({
          status: nextStatus,
          subject: template.subject,
          content: template.content,
          UserId: order.UserId,
          OrderId: order.id,
        });
      } catch (messageError) {
        console.error("Failed to create order status message:", messageError);
      }
    }

    return res.json({
      message: "Offline payment settlement approved and recorded.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  getById,
  updateStatus,
  dashboard,
  setAutomationOverride,
  recheckPayment,
  setFraudReviewState,
  setOperationalData,
  createRefund,
  adjustOrderItems,
  applyOfflinePaymentOverride,
  approveOfflinePaymentOverride,
};
