const crypto = require("crypto");
const { Op } = require("sequelize");
const models = require("../models");
const { Order } = models;
const Payment = models.Payment || null;
const PaymentEvent = models.PaymentEvent || null;
const config = require("../config/env");
const {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} = require("../services/paymentService");
const {
  processSuccessfulPayment,
  markPaymentVerificationState,
} = require("../services/paymentLifecycleService");
const {
  incrementMetric,
  logInfo,
  logWarn,
  logError,
} = require("../services/observabilityService");
const { majorToMinor, minorToMajor, ensureMinorInt } = require("../utils/money");

const PAYMENT_OPEN_STATUSES = new Set(["pending_payment", "pending", "fraud_hold"]);
const REUSABLE_INITIAL_PAYMENT_STATUSES = new Set(["initialized", "pending", "processing"]);

const generateReference = (orderId) => {
  const suffix = crypto.randomBytes(6).toString("hex");
  return `ELLY-${orderId.slice(0, 8)}-${Date.now()}-${suffix}`;
};

const getDefaultCallbackUrl = () => {
  if (config.paystackCallbackUrl) {
    return config.paystackCallbackUrl;
  }
  return `${config.clientOrigin}/checkout/verify`;
};

const parseOrderIdFromReference = (reference) => {
  if (!reference || typeof reference !== "string") {
    return null;
  }

  const parts = reference.split("-");
  if (parts.length < 3) {
    return null;
  }

  return parts[1] || null;
};

const readIdempotencyKey = (req) => {
  const headerValue = req.get("Idempotency-Key") || req.get("x-idempotency-key");
  const bodyValue = req.body?.idempotencyKey;
  const raw = typeof headerValue === "string" && headerValue.trim() ? headerValue : bodyValue;

  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
};

const pickPaystackInitFromPayload = (payload = {}) => {
  const initializePayload = payload?.initialize;
  if (!initializePayload || typeof initializePayload !== "object") {
    return null;
  }

  return {
    authorizationUrl: initializePayload.authorization_url || null,
    accessCode: initializePayload.access_code || null,
  };
};

const initialize = async (req, res, next) => {
  try {
    const { orderId, callbackUrl } = req.body;
    const idempotencyKey = readIdempotencyKey(req);

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required." });
    }

    const order = await Order.findOne({ where: { id: orderId, ShopId: req.shopId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (req.user.role !== "admin" && order.UserId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (!PAYMENT_OPEN_STATUSES.has(order.status)) {
      return res.status(400).json({
        message: "This order is not eligible for payment initialization.",
        status: order.status,
      });
    }

    const shopCurrency = req.shopConfig?.branding?.currency || order.currency || "GHS";

    const currentMetadata = order.metadata || {};
    const currentPayment = currentMetadata.payment || {};

    if (currentPayment.status === "success") {
      return res.status(200).json({
        message: "Order is already paid.",
        alreadyPaid: true,
        orderId: order.id,
        status: order.status,
      });
    }

    const activePayment =
      Payment &&
      (await Payment.findOne({
        where: {
          OrderId: order.id,
          status: {
            [Op.in]: [...REUSABLE_INITIAL_PAYMENT_STATUSES],
          },
        },
        order: [["createdAt", "DESC"]],
      }));

    const metadataMatchesIdempotencyKey =
      idempotencyKey && currentPayment.idempotencyKey && currentPayment.idempotencyKey === idempotencyKey;

    const existingReference = currentPayment.reference || activePayment?.paymentReference || null;
    if (
      existingReference &&
      (metadataMatchesIdempotencyKey ||
        REUSABLE_INITIAL_PAYMENT_STATUSES.has(currentPayment.status) ||
        Boolean(activePayment))
    ) {
      const activeInitData = pickPaystackInitFromPayload(activePayment?.payload);

      return res.status(200).json({
        orderId: order.id,
        status: order.status,
        reference: existingReference,
        authorizationUrl: currentPayment.authorizationUrl || activeInitData?.authorizationUrl || null,
        accessCode: currentPayment.accessCode || activeInitData?.accessCode || null,
        idempotentReplay: true,
      });
    }

    const reference = generateReference(order.id);
    const safeCallbackUrl = callbackUrl || getDefaultCallbackUrl();

    const initResponse = await initializePaystackTransaction({
      email: req.user.email,
      amountMajor: minorToMajor(ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0))),
      reference,
      callbackUrl: safeCallbackUrl,
      currency: shopCurrency,
      metadata: {
        orderId: order.id,
        userId: order.UserId,
        source: "elly-shop-checkout",
      },
    });

    await order.update({
      metadata: {
        ...currentMetadata,
        payment: {
          ...currentPayment,
          provider: "paystack",
          status: "initialized",
          reference,
          initializedAt: new Date().toISOString(),
          callbackUrl: safeCallbackUrl,
          authorizationUrl: initResponse.data.authorization_url,
          accessCode: initResponse.data.access_code,
          idempotencyKey,
        },
      },
    });

    if (Payment) {
      await Payment.create({
        OrderId: order.id,
        paymentReference: reference,
        provider: "paystack",
        status: "initialized",
        amount: ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0)),
        currency: shopCurrency,
        payload: {
          initialize: initResponse.data,
        },
      });
    }

    return res.status(200).json({
      orderId: order.id,
      status: order.status,
      reference,
      authorizationUrl: initResponse.data.authorization_url,
      accessCode: initResponse.data.access_code,
    });
  } catch (error) {
    return next(error);
  }
};

const verify = async (req, res, next) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ message: "Reference is required." });
    }

    const verification = await verifyPaystackTransaction(reference);
    const data = verification.data || {};
    const paymentSucceeded = data.status === "success";

    const metadataOrderId = data.metadata?.orderId;

    let payment =
      Payment &&
      (await Payment.findOne({
        where: { paymentReference: reference },
        include: [{ model: Order }],
      }));

    let order = payment?.Order || null;

    if (!order && metadataOrderId) {
      order = await Order.findOne({ where: { id: metadataOrderId, ShopId: req.shopId } });
    }

    if (!order) {
      const referenceHint = parseOrderIdFromReference(reference);
      const fallbackCandidates = referenceHint
        ? await Order.findAll({
            where: {
              id: {
                [Op.like]: `${referenceHint}%`,
                
              },
              ShopId: req.shopId,
            },
            order: [["createdAt", "DESC"]],
            limit: 5,
          })
        : [];

      order =
        fallbackCandidates.find(
          (candidate) => candidate?.metadata?.payment?.reference === reference
        ) || null;
    }

    if (!order) {
      const recentCandidates = await Order.findAll({
        where: { ShopId: req.shopId },
        order: [["createdAt", "DESC"]],
        limit: 200,
      });

      order =
        recentCandidates.find(
          (candidate) => candidate?.metadata?.payment?.reference === reference
        ) || null;
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found for this payment reference." });
    }

    if (req.user.role !== "admin" && order.UserId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (!paymentSucceeded) {
      await markPaymentVerificationState({
        order,
        reference,
        gatewayData: data,
        verificationSource: "gateway_verify",
        actorRole: req.user.role || "customer",
        actorUserId: req.user.id,
      });

      return res.status(200).json({
        verified: false,
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: data.status || "failed",
      });
    }

    if (!payment && Payment) {
      payment = await Payment.create({
        OrderId: order.id,
        paymentReference: reference,
        provider: "paystack",
        status: data.status || "initialized",
        amount:
          data.amount !== undefined && data.amount !== null
            ? ensureMinorInt(data.amount)
            : ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0)),
        currency: data.currency || order.currency || "GHS",
        payload: data,
      });
    }

    const settled = await processSuccessfulPayment(payment, {
      order,
      reference,
      gatewayData: data,
      actorRole: req.user.role || "customer",
      actorUserId: req.user.id,
      verificationSource: "gateway_verify",
    });

    return res.status(200).json({
      verified: true,
      orderId: order.id,
      orderStatus: settled.order.status,
      paymentStatus: "success",
      alreadyPaid: settled.alreadyPaid,
    });
  } catch (error) {
    return next(error);
  }
};

const callback = (req, res) => {
  const referenceParam = req.query.reference || req.query.trxref;
  const reference = typeof referenceParam === "string" ? referenceParam : "";

  const redirectUrl = new URL("/checkout/verify", config.clientOrigin);
  if (reference) {
    redirectUrl.searchParams.set("reference", reference);
  }

  return res.redirect(302, redirectUrl.toString());
};

const webhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const rawBody = req.rawBody || "";

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      incrementMetric("payment.webhook.failures", 1, { reason: "invalid_signature" });
      logWarn("payment.webhook.invalid_signature", {
        ip: req.ip || null,
        hasSignature: Boolean(signature),
        rawBodyLength: rawBody.length,
      });
      return res.status(401).json({ message: "Invalid webhook signature." });
    }

    const event = req.body?.event;
    const data = req.body?.data || {};
    const reference = data.reference;

    if (!reference) {
      incrementMetric("payment.webhook.failures", 1, { reason: "missing_reference" });
      logWarn("payment.webhook.missing_reference", {
        event: event || "unknown",
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    const existingEvent =
      PaymentEvent &&
      (await PaymentEvent.findOne({
        where: {
          paymentReference: reference,
          eventType: event || "unknown",
        },
      }));

    if (existingEvent) {
      incrementMetric("payment.webhook.duplicate", 1, { event: event || "unknown" });
      logInfo("payment.webhook.duplicate_event", {
        reference,
        event: event || "unknown",
      });
      return res.status(200).json({ received: true, duplicate: true });
    }

    if (event !== "charge.success") {
      incrementMetric("payment.webhook.ignored", 1, {
        reason: "unsupported_event",
        event: event || "unknown",
      });
      logInfo("payment.webhook.ignored", {
        reason: "unsupported_event",
        event: event || "unknown",
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    const metadataOrderId = data.metadata?.orderId;

    if (!reference || !metadataOrderId) {
      incrementMetric("payment.webhook.failures", 1, { reason: "missing_reference_or_order" });
      logWarn("payment.webhook.missing_reference_or_order", {
        hasReference: Boolean(reference),
        hasMetadataOrderId: Boolean(metadataOrderId),
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    const order = await Order.findOne({ where: { id: metadataOrderId, ShopId: req.shopId } });
    if (!order) {
      incrementMetric("payment.webhook.failures", 1, { reason: "order_not_found" });
      logWarn("payment.webhook.order_not_found", {
        orderId: metadataOrderId,
        reference,
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    let payment =
      Payment &&
      (await Payment.findOne({
        where: { paymentReference: reference },
        include: [{ model: Order }],
      }));

    if (!payment && Payment) {
      payment = await Payment.create({
        OrderId: order.id,
        paymentReference: reference,
        provider: "paystack",
        status: data.status || "initialized",
        amount:
          data.amount !== undefined && data.amount !== null
            ? ensureMinorInt(data.amount)
            : ensureMinorInt(order.totalMinor || majorToMinor(order.total || 0)),
        currency: data.currency || order.currency || "GHS",
        payload: data,
      });
    }

    await processSuccessfulPayment(payment, {
      order,
      reference,
      gatewayData: data,
      actorRole: "system",
      actorUserId: null,
      verificationSource: "gateway_webhook",
    });

    if (PaymentEvent) {
      try {
        await PaymentEvent.create({
          paymentReference: reference,
          eventType: event,
          payload: req.body,
          processedAt: new Date(),
        });
      } catch (error) {
        if (error.name !== "SequelizeUniqueConstraintError") {
          throw error;
        }
      }
    }

    incrementMetric("payment.webhook.success", 1, { event: "charge.success" });
    logInfo("payment.webhook.settled", {
      orderId: order.id,
      reference,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    incrementMetric("payment.webhook.failures", 1, { reason: "exception" });
    logError(
      "payment.webhook.exception",
      {
        ip: req.ip || null,
      },
      error
    );
    return next(error);
  }
};

module.exports = {
  initialize,
  verify,
  callback,
  webhook,
};
