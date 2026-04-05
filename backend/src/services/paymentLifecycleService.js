const db = require("../config/database");
const { Order, OrderStatusEvent, Payment } = require("../models");
const { majorToMinor, minorToMajor, ensureMinorInt } = require("../utils/money");

const MAX_PAYMENT_AUDIT_ENTRIES = 100;

const appendPaymentAuditEntry = (currentPayment, entry) => {
  const existing = Array.isArray(currentPayment?.auditTrail)
    ? currentPayment.auditTrail
    : [];

  return [...existing, entry].slice(-MAX_PAYMENT_AUDIT_ENTRIES);
};

const resolveNextOrderStatus = (currentStatus) => {
  return currentStatus === "fraud_hold" ? "fraud_hold" : "paid";
};

const runInTransaction = async (work) => {
  if (typeof db.transaction === "function") {
    return db.transaction(work);
  }

  // Fallback for mocked test environments without transaction helpers.
  return work({ LOCK: { UPDATE: "UPDATE" } });
};

const ensurePaymentRecord = async ({
  order,
  reference,
  gatewayData,
  transaction,
  provider = "paystack",
}) => {
  if (!Payment) {
    return null;
  }

  const [payment] = await Payment.findOrCreate({
    where: { paymentReference: reference },
    defaults: {
      OrderId: order.id,
      paymentReference: reference,
      provider,
      status: gatewayData?.status || "initialized",
      amount:
        gatewayData?.amount !== undefined && gatewayData?.amount !== null
          ? ensureMinorInt(gatewayData.amount)
          : ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0)),
      currency: gatewayData?.currency || order.currency || "GHS",
      payload: gatewayData || null,
      verifiedAt: new Date(),
    },
    transaction,
  });

  if (payment.OrderId !== order.id) {
    throw new Error("Payment reference is already associated with a different order.");
  }

  return payment;
};

const processSuccessfulPayment = async (
  payment,
  {
    order,
    reference,
    gatewayData,
    actorRole = "system",
    actorUserId = null,
    verificationSource = null,
    statusEventNote,
  } = {}
) => {
  return runInTransaction(async (transaction) => {
    let lockedPayment = payment;

    if (!lockedPayment && reference && Payment) {
      lockedPayment = await Payment.findOne({
        where: { paymentReference: reference },
        include: [{ model: Order }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    } else if (lockedPayment && Payment) {
      lockedPayment = await Payment.findByPk(lockedPayment.id, {
        include: [{ model: Order }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    const targetOrder = order || lockedPayment?.Order;
    const resolvedReference = reference || lockedPayment?.paymentReference;

    if (!targetOrder || !resolvedReference) {
      throw new Error("Order and payment reference are required to process a successful payment.");
    }

    const lockedOrder =
      (await Order.findByPk(targetOrder.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) || targetOrder;

    const paymentRecord =
      lockedPayment ||
      (await ensurePaymentRecord({
        order: lockedOrder,
        reference: resolvedReference,
        gatewayData,
        transaction,
      }));

    if (paymentRecord && paymentRecord.status === "success") {
      return {
        order: lockedOrder,
        payment: paymentRecord,
        alreadyPaid: true,
        transitioned: false,
      };
    }

    const currentMetadata = lockedOrder.metadata || {};
    const currentPayment = currentMetadata.payment || {};

    const nowIso = new Date().toISOString();
    const paymentAmountMinor = ensureMinorInt(
      gatewayData?.amount !== undefined && gatewayData?.amount !== null
        ? gatewayData.amount
        : paymentRecord?.amount || lockedOrder.balanceDue || 0
    );
    const totalAmountMinor = ensureMinorInt(lockedOrder.totalMinor || majorToMinor(lockedOrder.total || 0));
    const currentPaidMinor = ensureMinorInt(lockedOrder.totalPaid || 0);
    const nextPaidMinor = currentPaidMinor + paymentAmountMinor;
    const nextBalanceDue = Math.max(totalAmountMinor - nextPaidMinor, 0);
    const isFullyPaid = nextPaidMinor >= totalAmountMinor;
    const alreadyFullyPaid = ensureMinorInt(lockedOrder.balanceDue || 0) <= 0;

    if (alreadyFullyPaid && currentPayment.reference && currentPayment.reference !== resolvedReference) {
      const nowIso = new Date().toISOString();

      if (paymentRecord) {
        await paymentRecord.update(
          {
            status: "success",
            payload: gatewayData || paymentRecord.payload,
            processedAt: new Date(nowIso),
            verifiedAt: new Date(nowIso),
            amount: paymentAmountMinor,
          },
          { transaction }
        );
      }

      await lockedOrder.update(
        {
          metadata: {
            ...currentMetadata,
            payment: {
              ...currentPayment,
              duplicateReference: resolvedReference,
              duplicateDetectedAt: nowIso,
              auditTrail: appendPaymentAuditEntry(currentPayment, {
                action: "duplicate_success_ignored",
                source: verificationSource || "unknown",
                actorRole,
                actorUserId,
                status: "success",
                reference: resolvedReference,
                note: "Duplicate success callback ignored because order is already fully paid.",
                timestamp: nowIso,
              }),
            },
          },
        },
        { transaction }
      );

      return {
        order: lockedOrder,
        payment: paymentRecord,
        alreadyPaid: true,
        transitioned: false,
        duplicateIgnored: true,
      };
    }

    const previousStatus = lockedOrder.status;
    const nextStatus = isFullyPaid ? resolveNextOrderStatus(previousStatus) : previousStatus;
    const statusChanged = previousStatus !== nextStatus;

    const nextPaymentMetadata = {
      ...currentPayment,
      provider: "paystack",
      status: "success",
      reference: resolvedReference,
      paidAt: nowIso,
      verifiedAt: nowIso,
      verificationSource: verificationSource || currentPayment.verificationSource || null,
      verificationActorRole: actorRole,
      verificationActorUserId: actorUserId,
      gatewayStatus: gatewayData?.gateway_response || gatewayData?.status || "success",
      channel: gatewayData?.channel || null,
      gatewayPaidAt: gatewayData?.paid_at || null,
      amountSmallestUnit: gatewayData?.amount || null,
      amountMinor: paymentAmountMinor,
      auditTrail: appendPaymentAuditEntry(currentPayment, {
        action: "payment_settled",
        source: verificationSource || "unknown",
        actorRole,
        actorUserId,
        status: "success",
        reference: resolvedReference,
        gatewayStatus: gatewayData?.gateway_response || gatewayData?.status || "success",
        note: statusEventNote || null,
        timestamp: nowIso,
      }),
    };

    if (paymentRecord) {
      await paymentRecord.update(
        {
          status: "success",
          payload: gatewayData || paymentRecord.payload,
          processedAt: new Date(nowIso),
          verifiedAt: new Date(nowIso),
          amount: paymentAmountMinor,
        },
        { transaction }
      );
    }

    await lockedOrder.update(
      {
        status: nextStatus,
        totalPaid: nextPaidMinor,
        balanceDue: nextBalanceDue,
        totalMinor: totalAmountMinor,
        total: minorToMajor(totalAmountMinor),
        metadata: {
          ...currentMetadata,
          payment: nextPaymentMetadata,
        },
      },
      { transaction }
    );

    await OrderStatusEvent.create({
      OrderId: lockedOrder.id,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      actorRole,
      actorUserId,
      note:
        statusEventNote ||
        (statusChanged
          ? "Payment confirmed via Paystack."
          : "Payment confirmed via Paystack; order remains under review."),
      metadata: {
        payment: {
          reference: resolvedReference,
          provider: "paystack",
          paymentId: paymentRecord?.id || null,
        },
      },
    });

    return {
      order: lockedOrder,
      payment: paymentRecord,
      alreadyPaid: false,
      transitioned: statusChanged,
    };
  });
};

const markPaymentSuccess = async ({
  order,
  reference,
  gatewayData,
  actorRole = "system",
  actorUserId = null,
  verificationSource = null,
  statusEventNote,
}) => {
  return processSuccessfulPayment(null, {
    order,
    reference,
    gatewayData,
    actorRole,
    actorUserId,
    verificationSource,
    statusEventNote,
  });
};

const markPaymentVerificationState = async ({
  order,
  reference,
  gatewayData,
  verificationSource = null,
  actorRole = null,
  actorUserId = null,
}) => {
  await runInTransaction(async (transaction) => {
    const lockedOrder = await Order.findByPk(order.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const currentMetadata = lockedOrder.metadata || {};
    const currentPayment = currentMetadata.payment || {};

    const paymentRecord = await ensurePaymentRecord({
      order: lockedOrder,
      reference,
      gatewayData,
      transaction,
    });

    if (paymentRecord) {
      await paymentRecord.update(
        {
          status: gatewayData?.status || "failed",
          payload: gatewayData || paymentRecord.payload,
          verifiedAt: new Date(),
        },
        { transaction }
      );
    }

    await lockedOrder.update(
      {
        metadata: {
          ...currentMetadata,
          payment: {
            ...currentPayment,
            provider: "paystack",
            status: gatewayData?.status || "failed",
            reference,
            verifiedAt: new Date().toISOString(),
            verificationSource: verificationSource || currentPayment.verificationSource || null,
            verificationActorRole: actorRole || currentPayment.verificationActorRole || null,
            verificationActorUserId: actorUserId || currentPayment.verificationActorUserId || null,
            gatewayStatus: gatewayData?.gateway_response || gatewayData?.status || "failed",
            auditTrail: appendPaymentAuditEntry(currentPayment, {
              action: "payment_verification_checked",
              source: verificationSource || "unknown",
              actorRole: actorRole || null,
              actorUserId: actorUserId || null,
              status: gatewayData?.status || "failed",
              reference,
              gatewayStatus: gatewayData?.gateway_response || gatewayData?.status || "failed",
              timestamp: new Date().toISOString(),
            }),
          },
        },
      },
      { transaction }
    );
  });

  return {
    order,
    paymentStatus: gatewayData?.status || "failed",
  };
};

module.exports = {
  processSuccessfulPayment,
  markPaymentSuccess,
  markPaymentVerificationState,
};
