const { Order, OrderStatusEvent, OrderNotification, User } = require("../models");
const { Op } = require("sequelize");
const slaConfig = require("../config/sla");
const { buildOrderStatusMessage } = require("./orderMessageTemplates");
const { processPaymentReconciliations } = require("./paymentReconciliationService");
const { runReconciliationJob } = require("../scripts/reconciliationJob");
const {
  transitionOrderStatus,
  OrderTransitionError,
} = require("./orderStateMachineService");
const {
  incrementMetric,
  setMetric,
  logInfo,
  logWarn,
  logError,
} = require("./observabilityService");

const ALERTABLE_PENDING_PAYMENT_STATUSES = ["pending_payment", "pending"];
let lastDailyPaymentReconciliationDateKey = null;
let lastDailyDriftReconciliationDateKey = null;

const getPendingPaymentAlertConfig = () => {
  const config = slaConfig.pendingPaymentAlerts || {};

  return {
    enabled: config.enabled !== false,
    thresholdHours: Number(config.thresholdHours || 2),
    repeatAlertAfterHours: Number(config.repeatAlertAfterHours || 24),
    maxOrdersPerRun: Number(config.maxOrdersPerRun || 50),
  };
};

const getDailyPaymentReconciliationConfig = () => {
  const config = slaConfig.paymentReconciliation || {};

  return {
    enabled: config.dailyEnabled !== false,
    runHourUtc: Number(config.dailyRunHourUtc ?? 2),
  };
};

const shouldRunDailyPaymentReconciliation = (now = new Date()) => {
  const dailyConfig = getDailyPaymentReconciliationConfig();

  if (!dailyConfig.enabled) {
    return {
      shouldRun: false,
      reason: "daily_disabled",
      dateKey: now.toISOString().slice(0, 10),
    };
  }

  const normalizedRunHour = Math.max(0, Math.min(23, dailyConfig.runHourUtc));
  if (now.getUTCHours() !== normalizedRunHour) {
    return {
      shouldRun: false,
      reason: "outside_daily_window",
      dateKey: now.toISOString().slice(0, 10),
    };
  }

  const dateKey = now.toISOString().slice(0, 10);
  if (lastDailyPaymentReconciliationDateKey === dateKey) {
    return {
      shouldRun: false,
      reason: "already_ran_today",
      dateKey,
    };
  }

  return {
    shouldRun: true,
    reason: null,
    dateKey,
  };
};

/**
 * Auto-transition delivered orders to received after grace period
 */
const processDeliveryConfirmations = async () => {
  if (!slaConfig.autoTransitions.deliveredToReceived) {
    return { processed: 0, message: "Auto-transition disabled" };
  }

  const graceWindowMs = slaConfig.deliveryConfirmationGraceHours * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - graceWindowMs);

  const eligibleOrders = await Order.findAll({
    where: {
      status: "delivered",
      updatedAt: {
        [Op.lte]: cutoffTime,
      },
    },
    include: [{ model: User }],
  });

  const results = [];

  for (const order of eligibleOrders) {
    try {
      // Check if automation is disabled for this order
      if (order.metadata?.automationOverride?.preventAutoTransition) {
        console.log(
          `⏸️  Skipping auto-transition for order ${order.id.slice(0, 8)}: ${
            order.metadata.automationOverride.reason || "Manual override"
          }`
        );
        continue;
      }

      // Check if customer has raised any issues (you can add logic here)
      // For now, we'll just auto-confirm all eligible orders
      await transitionOrderStatus({
        orderId: order.id,
        nextStatus: "received",
        actorRole: "system",
        actorUserId: null,
        note: `Auto-confirmed after ${slaConfig.deliveryConfirmationGraceHours}h grace period`,
        metadata: {
          automationType: "delivery_confirmation",
          graceHours: slaConfig.deliveryConfirmationGraceHours,
        },
      });

      // Send notification to customer
      if (slaConfig.notifications.onAutoReceived) {
        try {
          const template = buildOrderStatusMessage("received", order);
          await OrderNotification.create({
            status: "received",
            subject: template.subject,
            content: `${template.content} We hope you're happy with your purchase! You can leave a review or request a return within the return window.`,
            UserId: order.UserId,
            OrderId: order.id,
          });
        } catch (notificationError) {
          console.error("Failed to send auto-received notification:", notificationError);
        }
      }

      results.push({
        orderId: order.id,
        success: true,
        action: "auto_received",
      });
    } catch (error) {
      console.error(`Failed to auto-confirm order ${order.id}:`, error);
      results.push({
        orderId: order.id,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    processed: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
};

/**
 * Flag orders that are delayed based on SLA thresholds
 */
const flagDelayedOrders = async () => {
  const now = new Date();
  const flaggedOrders = [];

  for (const [status, thresholdHours] of Object.entries(slaConfig.delayedShipmentThresholds)) {
    const cutoffTime = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);

    const delayedOrders = await Order.findAll({
      where: {
        status,
        updatedAt: {
          [Op.lte]: cutoffTime,
        },
      },
      include: [{ model: User }],
    });

    for (const order of delayedOrders) {
      try {
        // Check if we've already flagged this order recently
        const recentFlag = await OrderStatusEvent.findOne({
          where: {
            OrderId: order.id,
            note: {
              [Op.like]: "%SLA breach detected%",
            },
            createdAt: {
              [Op.gte]: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24h
            },
          },
        });

        if (!recentFlag) {
          // Log SLA breach event
          await OrderStatusEvent.create({
            OrderId: order.id,
            fromStatus: status,
            toStatus: status,
            actorRole: "system",
            actorUserId: null,
            note: `SLA breach detected: ${status} for ${thresholdHours}+ hours`,
            metadata: {
              automationType: "sla_breach",
              status,
              thresholdHours,
              actualHours: Math.floor(
                (now.getTime() - new Date(order.updatedAt).getTime()) / (1000 * 60 * 60)
              ),
            },
          });

          // Notify admin if configured
          if (slaConfig.notifications.onSLABreach) {
            // Create admin notification (you can filter by admin role in the notification system)
            await OrderNotification.create({
              status: "sla_breach",
              subject: `⚠️ Order ${order.id.slice(0, 8)} delayed`,
              content: `Order has been in ${status} status for over ${thresholdHours} hours. Please review for fulfillment issues.`,
              UserId: order.UserId,
              OrderId: order.id,
            });
          }

          flaggedOrders.push({
            orderId: order.id,
            status,
            thresholdHours,
            actualHours: Math.floor(
              (now.getTime() - new Date(order.updatedAt).getTime()) / (1000 * 60 * 60)
            ),
          });
        }
      } catch (error) {
        console.error(`Failed to flag delayed order ${order.id}:`, error);
      }
    }
  }

  return {
    flagged: flaggedOrders.length,
    orders: flaggedOrders,
  };
};

const processAgedPendingPaymentAlerts = async () => {
  const alertConfig = getPendingPaymentAlertConfig();

  if (!alertConfig.enabled) {
    return {
      enabled: false,
      scanned: 0,
      alerted: 0,
      skipped: 0,
      failed: 0,
      orders: [],
      message: "Pending payment alerting disabled",
    };
  }

  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - alertConfig.thresholdHours * 60 * 60 * 1000);
  const repeatCutoff = new Date(
    now.getTime() - alertConfig.repeatAlertAfterHours * 60 * 60 * 1000
  );

  const candidates = await Order.findAll({
    where: {
      status: {
        [Op.in]: ALERTABLE_PENDING_PAYMENT_STATUSES,
      },
      updatedAt: {
        [Op.lte]: pendingCutoff,
      },
    },
    order: [["updatedAt", "ASC"]],
    limit: alertConfig.maxOrdersPerRun,
  });

  const results = {
    enabled: true,
    scanned: candidates.length,
    alerted: 0,
    skipped: 0,
    failed: 0,
    orders: [],
  };

  for (const order of candidates) {
    try {
      const recentAlert = await OrderStatusEvent.findOne({
        where: {
          OrderId: order.id,
          note: {
            [Op.like]: "%Pending payment alert:%",
          },
          createdAt: {
            [Op.gte]: repeatCutoff,
          },
        },
      });

      if (recentAlert) {
        results.skipped += 1;
        continue;
      }

      const ageHours = Math.floor(
        (now.getTime() - new Date(order.updatedAt).getTime()) / (1000 * 60 * 60)
      );

      await OrderStatusEvent.create({
        OrderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        actorRole: "system",
        actorUserId: null,
        note: `Pending payment alert: ${order.status} for ${ageHours}+ hours`,
        metadata: {
          automationType: "pending_payment_alert",
          status: order.status,
          thresholdHours: alertConfig.thresholdHours,
          ageHours,
        },
      });

      await OrderNotification.create({
        status: "pending_payment_alert",
        subject: `Pending payment aging alert: ${order.id.slice(0, 8)}`,
        content: `Order has been in '${order.status}' for ${ageHours} hours. Please review payment completion or follow up with the customer.`,
        UserId: order.UserId,
        OrderId: order.id,
      });

      results.alerted += 1;
      incrementMetric("pending_payment.alerts_triggered", 1, {
        status: order.status,
      });
      results.orders.push({
        orderId: order.id,
        status: order.status,
        ageHours,
      });
    } catch (error) {
      results.failed += 1;
      incrementMetric("pending_payment.alert_errors", 1);
      logError(
        "pending_payment.alert_failed",
        {
          orderId: order.id,
        },
        error
      );
    }
  }

  setMetric("pending_payment.alert_candidates", results.scanned);
  setMetric("pending_payment.alerted_count", results.alerted);
  setMetric("pending_payment.alert_failures", results.failed);

  if (results.alerted > 0) {
    logWarn("pending_payment.alerts_triggered", {
      scanned: results.scanned,
      alerted: results.alerted,
      skipped: results.skipped,
      failed: results.failed,
    });
  } else {
    logInfo("pending_payment.alerts_checked", {
      scanned: results.scanned,
      skipped: results.skipped,
      failed: results.failed,
    });
  }

  return results;
};

/**
 * Run all SLA automation jobs
 */
const runSLAJobs = async () => {
  console.log("🤖 Running SLA automation jobs...");

  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    jobs: {},
  };

  try {
    // Job 1: Auto-confirm deliveries
    const deliveryResults = await processDeliveryConfirmations();
    results.jobs.deliveryConfirmations = deliveryResults;
    console.log(
      `✅ Delivery confirmations: ${deliveryResults.successful}/${deliveryResults.processed} processed`
    );
  } catch (error) {
    console.error("❌ Delivery confirmation job failed:", error);
    results.jobs.deliveryConfirmations = { error: error.message };
  }

  try {
    // Job 2: Flag delayed orders
    const delayedResults = await flagDelayedOrders();
    results.jobs.delayedOrders = delayedResults;
    console.log(`🚩 Delayed orders flagged: ${delayedResults.flagged}`);
  } catch (error) {
    console.error("❌ Delayed orders job failed:", error);
    results.jobs.delayedOrders = { error: error.message };
  }

  try {
    // Job 3: Reconcile stale pending payments with gateway records
    const paymentResults = await processPaymentReconciliations({ mode: "continuous" });
    results.jobs.paymentReconciliation = paymentResults;

    if (paymentResults.enabled === false) {
      console.log("💳 Payment reconciliation skipped: disabled");
    } else {
      console.log(
        `💳 Payment reconciliation: ${paymentResults.reconciled}/${paymentResults.attempted} reconciled`
      );
    }
  } catch (error) {
    console.error("❌ Payment reconciliation job failed:", error);
    results.jobs.paymentReconciliation = { error: error.message };
  }

  try {
    // Job 3b: Run a deeper once-daily reconciliation pass
    const dailyCheck = shouldRunDailyPaymentReconciliation(new Date());
    if (dailyCheck.shouldRun) {
      const dailyPaymentResults = await processPaymentReconciliations({ mode: "daily" });
      results.jobs.paymentReconciliationDaily = dailyPaymentResults;
      lastDailyPaymentReconciliationDateKey = dailyCheck.dateKey;

      if (dailyPaymentResults.enabled === false) {
        console.log("🗓️ Daily payment reconciliation skipped: disabled");
      } else {
        console.log(
          `🗓️ Daily reconciliation: ${dailyPaymentResults.reconciled}/${dailyPaymentResults.attempted} reconciled`
        );
      }
    } else {
      results.jobs.paymentReconciliationDaily = {
        skipped: true,
        reason: dailyCheck.reason,
      };
    }
  } catch (error) {
    console.error("❌ Daily payment reconciliation job failed:", error);
    results.jobs.paymentReconciliationDaily = { error: error.message };
  }

  try {
    // Job 3c: Generate a once-daily reconciliation drift report (orders vs payments)
    const dailyCheck = shouldRunDailyPaymentReconciliation(new Date());
    if (dailyCheck.shouldRun && lastDailyDriftReconciliationDateKey !== dailyCheck.dateKey) {
      const driftReport = await runReconciliationJob();
      results.jobs.reconciliationReport = {
        generatedAt: driftReport.generatedAt,
        period: driftReport.period,
        totals: driftReport.totals,
        counts: driftReport.counts,
      };
      lastDailyDriftReconciliationDateKey = dailyCheck.dateKey;
      console.log(
        `📊 Daily drift report: ${driftReport.counts.paidOrdersWithoutSuccessfulPayment} paid-without-payment, ${driftReport.counts.successfulPaymentsWithoutOrder} orphan-payments`
      );
    } else {
      results.jobs.reconciliationReport = {
        skipped: true,
        reason: dailyCheck.reason || "already_ran_today",
      };
    }
  } catch (error) {
    console.error("❌ Daily drift reconciliation report failed:", error);
    results.jobs.reconciliationReport = { error: error.message };
  }

  try {
    // Job 4: Alert on aged pending-payment orders
    const pendingPaymentAlertResults = await processAgedPendingPaymentAlerts();
    results.jobs.pendingPaymentAlerts = pendingPaymentAlertResults;

    if (pendingPaymentAlertResults.enabled === false) {
      console.log("🔕 Pending payment alerts skipped: disabled");
    } else {
      console.log(
        `🔔 Pending payment alerts: ${pendingPaymentAlertResults.alerted}/${pendingPaymentAlertResults.scanned}`
      );
    }
  } catch (error) {
    console.error("❌ Pending payment alert job failed:", error);
    results.jobs.pendingPaymentAlerts = { error: error.message };
  }

  const duration = Date.now() - startTime;
  results.durationMs = duration;

  console.log(`⏱️  SLA jobs completed in ${duration}ms`);

  return results;
};

module.exports = {
  runSLAJobs,
  processDeliveryConfirmations,
  flagDelayedOrders,
  processAgedPendingPaymentAlerts,
};
