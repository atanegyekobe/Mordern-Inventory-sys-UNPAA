const { Op } = require("sequelize");
const { Order } = require("../models");
const slaConfig = require("../config/sla");
const { verifyPaystackTransaction } = require("./paymentService");
const {
  markPaymentSuccess,
  markPaymentVerificationState,
} = require("./paymentLifecycleService");
const {
  incrementMetric,
  setMetric,
  logInfo,
  logWarn,
  logError,
} = require("./observabilityService");

const RECONCILABLE_STATUSES = new Set(["pending_payment", "pending", "fraud_hold"]);
const ORDER_ADVANCED_PAYMENT_STATUSES = new Set([
  "paid",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivery_pickup",
  "delivered",
  "received",
  "fulfilled",
  "refunded",
]);
const ORDER_PENDING_PAYMENT_STATUSES = new Set(["pending_payment", "pending", "fraud_hold"]);

const getReconciliationConfig = (mode = "continuous") => {
  const config = slaConfig.paymentReconciliation || {};
  const isDailyMode = mode === "daily";

  return {
    mode,
    enabled: config.enabled !== false,
    lookbackHours: Number(
      isDailyMode ? config.dailyLookbackHours || config.lookbackHours || 72 : config.lookbackHours || 72
    ),
    minInitializationAgeMinutes: Number(config.minInitializationAgeMinutes || 2),
    maxOrdersPerRun: Number(
      isDailyMode ? config.dailyMaxOrdersPerRun || config.maxOrdersPerRun || 50 : config.maxOrdersPerRun || 50
    ),
    mismatchLookbackHours: Number(config.mismatchLookbackHours || 72),
    mismatchMaxOrders: Number(config.mismatchMaxOrders || 300),
  };
};

const getPaymentStatus = (order) => {
  return String(order?.metadata?.payment?.status || "unknown").toLowerCase();
};

const computePaymentMismatchSnapshot = async ({ lookbackHours, maxOrders }) => {
  const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const recentOrders = await Order.findAll({
    where: {
      updatedAt: {
        [Op.gte]: lookbackDate,
      },
    },
    attributes: ["id", "status", "metadata", "updatedAt"],
    order: [["updatedAt", "DESC"]],
    limit: maxOrders,
  });

  let successButOrderPending = 0;
  let unsettledButOrderAdvanced = 0;
  const samples = [];

  for (const order of recentOrders) {
    const paymentStatus = getPaymentStatus(order);
    const paymentSuccessful = paymentStatus === "success";
    const orderPending = ORDER_PENDING_PAYMENT_STATUSES.has(order.status);
    const orderAdvanced = ORDER_ADVANCED_PAYMENT_STATUSES.has(order.status);

    if (paymentSuccessful && orderPending) {
      successButOrderPending += 1;
      if (samples.length < 10) {
        samples.push({
          orderId: order.id,
          type: "success_but_pending_order",
          orderStatus: order.status,
          paymentStatus,
        });
      }
      continue;
    }

    if (!paymentSuccessful && orderAdvanced) {
      unsettledButOrderAdvanced += 1;
      if (samples.length < 10) {
        samples.push({
          orderId: order.id,
          type: "unsettled_but_advanced_order",
          orderStatus: order.status,
          paymentStatus,
        });
      }
    }
  }

  const total = successButOrderPending + unsettledButOrderAdvanced;
  setMetric("payment.mismatch.total", total);
  setMetric("payment.mismatch.success_pending_order", successButOrderPending);
  setMetric("payment.mismatch.unsettled_advanced_order", unsettledButOrderAdvanced);

  if (total > 0) {
    incrementMetric("payment.mismatch.detected", total);
    logWarn("payment.mismatch.snapshot", {
      total,
      successButOrderPending,
      unsettledButOrderAdvanced,
    });
  }

  return {
    total,
    successButOrderPending,
    unsettledButOrderAdvanced,
    sampledOrders: samples,
    scanned: recentOrders.length,
  };
};

const processPaymentReconciliations = async (options = {}) => {
  const mode = options.mode || "continuous";
  const reconciliationConfig = getReconciliationConfig(mode);
  const mismatchSnapshot = await computePaymentMismatchSnapshot({
    lookbackHours: reconciliationConfig.mismatchLookbackHours,
    maxOrders: reconciliationConfig.mismatchMaxOrders,
  });

  logInfo("payment.reconciliation.run_started", {
    config: reconciliationConfig,
  });

  if (!reconciliationConfig.enabled) {
    incrementMetric("payment.reconciliation.disabled", 1);
    return {
      enabled: false,
      scanned: 0,
      attempted: 0,
      reconciled: 0,
      unresolved: 0,
      errors: 0,
      skipped: 0,
      mode,
      mismatches: mismatchSnapshot,
      details: [],
      message: "Payment reconciliation disabled",
    };
  }

  const now = Date.now();
  const lookbackDate = new Date(
    now - reconciliationConfig.lookbackHours * 60 * 60 * 1000
  );
  const minInitAgeDate = new Date(
    now - reconciliationConfig.minInitializationAgeMinutes * 60 * 1000
  );

  const candidates = await Order.findAll({
    where: {
      status: {
        [Op.in]: Array.from(RECONCILABLE_STATUSES),
      },
      updatedAt: {
        [Op.gte]: lookbackDate,
      },
    },
    order: [["updatedAt", "ASC"]],
    limit: reconciliationConfig.maxOrdersPerRun,
  });

  const results = {
    enabled: true,
    mode,
    scanned: candidates.length,
    attempted: 0,
    reconciled: 0,
    unresolved: 0,
    errors: 0,
    skipped: 0,
    mismatches: mismatchSnapshot,
    details: [],
  };

  for (const order of candidates) {
    const payment = order.metadata?.payment || {};
    const reference = payment.reference;
    const initializedAt = payment.initializedAt ? new Date(payment.initializedAt) : null;
    const canBackfillPaidStatus =
      payment.status === "success" && ["pending_payment", "pending"].includes(order.status);

    const shouldSkip =
      !RECONCILABLE_STATUSES.has(order.status) ||
      payment.provider !== "paystack" ||
      !reference ||
      (!canBackfillPaidStatus && payment.status === "success") ||
      (initializedAt && initializedAt > minInitAgeDate);

    if (shouldSkip) {
      results.skipped += 1;
      incrementMetric("payment.reconciliation.skipped", 1);
      continue;
    }

    if (canBackfillPaidStatus) {
      const settlement = await markPaymentSuccess({
        order,
        reference,
        gatewayData: { status: "success" },
        actorRole: "system",
        actorUserId: null,
        verificationSource: mode === "daily" ? "reconciliation_daily" : "reconciliation_interval",
        statusEventNote:
          "Order status reconciled to paid from existing successful payment metadata.",
      });

      if (settlement.transitioned) {
        results.reconciled += 1;
        incrementMetric("payment.reconciliation.fixed", 1, {
          type: "status_backfill",
        });
        results.details.push({
          orderId: order.id,
          reference,
          action: "reconciled_status_from_metadata",
          status: settlement.order.status,
        });
      } else {
        results.skipped += 1;
        incrementMetric("payment.reconciliation.skipped", 1, {
          reason: "already_backfilled",
        });
      }

      continue;
    }

    results.attempted += 1;

    try {
      const verification = await verifyPaystackTransaction(reference);
      const gatewayData = verification.data || {};

      if (gatewayData.status === "success") {
        const settlement = await markPaymentSuccess({
          order,
          reference,
          gatewayData,
          actorRole: "system",
          actorUserId: null,
          verificationSource: mode === "daily" ? "reconciliation_daily" : "reconciliation_interval",
          statusEventNote: "Payment reconciled automatically via Paystack verification.",
        });

        if (!settlement.alreadyPaid) {
          results.reconciled += 1;
          incrementMetric("payment.reconciliation.fixed", 1, {
            type: "gateway_verify",
          });
          results.details.push({
            orderId: order.id,
            reference,
            action: "reconciled_paid",
            status: settlement.order.status,
          });
        }
      } else {
        await markPaymentVerificationState({
          order,
          reference,
          gatewayData,
          verificationSource: mode === "daily" ? "reconciliation_daily" : "reconciliation_interval",
          actorRole: "system",
          actorUserId: null,
        });

        results.unresolved += 1;
        incrementMetric("payment.reconciliation.unresolved", 1, {
          status: gatewayData.status || "failed",
        });
        results.details.push({
          orderId: order.id,
          reference,
          action: "verified_unresolved",
          paymentStatus: gatewayData.status || "failed",
        });
      }
    } catch (error) {
      results.errors += 1;
      incrementMetric("payment.reconciliation.errors", 1);
      logError(
        "payment.reconciliation.verification_error",
        {
          orderId: order.id,
          reference,
        },
        error
      );
      results.details.push({
        orderId: order.id,
        reference,
        action: "verification_error",
        error: error.message,
      });
    }
  }

  setMetric("payment.reconciliation.scanned", results.scanned);
  setMetric("payment.reconciliation.attempted", results.attempted);
  setMetric("payment.reconciliation.reconciled", results.reconciled);
  setMetric("payment.reconciliation.unresolved_count", results.unresolved);
  setMetric("payment.reconciliation.errors_count", results.errors);
  incrementMetric("payment.reconciliation.runs", 1, {
    mode,
  });

  if (results.errors > 0) {
    logWarn("payment.reconciliation.completed_with_errors", {
      scanned: results.scanned,
      attempted: results.attempted,
      reconciled: results.reconciled,
      unresolved: results.unresolved,
      errors: results.errors,
      skipped: results.skipped,
      mode,
    });
  } else {
    logInfo("payment.reconciliation.completed", {
      scanned: results.scanned,
      attempted: results.attempted,
      reconciled: results.reconciled,
      unresolved: results.unresolved,
      skipped: results.skipped,
      mode,
    });
  }

  return results;
};

module.exports = {
  processPaymentReconciliations,
};
