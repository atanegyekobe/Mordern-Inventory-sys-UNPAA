const express = require("express");
const request = require("supertest");

jest.mock("../../src/middleware/auth", () => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing auth token." });
    }

    req.user = {
      id: req.headers["x-test-user-id"] || "user-1",
      role: req.headers["x-test-role"] || "customer",
      email: req.headers["x-test-user-email"] || "test@example.com",
    };
    return next();
  };
});

jest.mock("../../src/services/paymentService", () => ({
  initializePaystackTransaction: jest.fn(),
  verifyPaystackTransaction: jest.fn(),
  createPaystackRefund: jest.fn(),
  verifyPaystackWebhookSignature: jest.fn(),
}));

jest.mock("../../src/services/orderMessageTemplates", () => ({
  buildOrderStatusMessage: jest.fn(() => ({
    subject: "Order update",
    content: "Your order status changed.",
  })),
}));

jest.mock("../../src/models", () => ({
  sequelize: {},
  User: {},
  Category: {},
  Product: {
    findByPk: jest.fn(),
  },
  ProductVariant: {},
  CategoryVariantTemplate: {},
  Cart: {},
  CartItem: {},
  Order: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  OrderItem: {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  },
  OrderStatusEvent: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  OrderNotification: {
    create: jest.fn(),
  },
  SLAJobRun: {},
  Coupon: {},
  Message: {},
  MessageReply: {},
}));

const paymentRoutes = require("../../src/routes/payments");
const orderRoutes = require("../../src/routes/orders");
const { notFound, errorHandler } = require("../../src/middleware/errorHandler");
const { Order, OrderItem, Product, OrderStatusEvent, OrderNotification } = require("../../src/models");
const {
  verifyPaystackTransaction,
  createPaystackRefund,
  verifyPaystackWebhookSignature,
} = require("../../src/services/paymentService");

const buildApp = () => {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        req.rawBody = buffer.toString("utf8");
      },
    })
  );

  app.use("/api/payments", paymentRoutes);
  app.use("/api/orders", orderRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

const createOrderMock = (overrides = {}) => {
  const order = {
    id: overrides.id || "order-1",
    UserId: overrides.UserId || "user-1",
    status: overrides.status || "pending_payment",
    total: overrides.total || 120,
    currency: overrides.currency || "GHS",
    metadata: overrides.metadata || {},
  };

  order.update = jest.fn(async (payload) => {
    Object.assign(order, payload);
    return order;
  });

  return order;
};

describe("Payment and order critical integration flows", () => {
  let app;
  let previousPaymentOverrideApprovers;
  let previousEnableOfflinePaymentOverride;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    previousPaymentOverrideApprovers = process.env.PAYMENT_OVERRIDE_APPROVERS;
    previousEnableOfflinePaymentOverride = process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE;
    delete process.env.PAYMENT_OVERRIDE_APPROVERS;
    delete process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE;
  });

  afterEach(() => {
    if (typeof previousPaymentOverrideApprovers === "string") {
      process.env.PAYMENT_OVERRIDE_APPROVERS = previousPaymentOverrideApprovers;
    } else {
      delete process.env.PAYMENT_OVERRIDE_APPROVERS;
    }

    if (typeof previousEnableOfflinePaymentOverride === "string") {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = previousEnableOfflinePaymentOverride;
    } else {
      delete process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE;
    }
  });

  describe("GET /api/payments/verify/:reference", () => {
    it("settles a successful Paystack verification to paid", async () => {
      const order = createOrderMock({ status: "pending_payment" });
      Order.findByPk.mockResolvedValue(order);
      verifyPaystackTransaction.mockResolvedValue({
        data: {
          status: "success",
          gateway_response: "Successful",
          reference: "ref-success",
          metadata: { orderId: order.id },
          channel: "card",
          amount: 12000,
          paid_at: "2026-03-13T12:00:00.000Z",
        },
      });

      const response = await request(app)
        .get("/api/payments/verify/ref-success")
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
      expect(response.body.orderStatus).toBe("paid");
      expect(order.status).toBe("paid");
      expect(order.metadata.payment.status).toBe("success");
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          fromStatus: "pending_payment",
          toStatus: "paid",
        })
      );
    });

    it("keeps order open and stores failure metadata when verification is not successful", async () => {
      const order = createOrderMock({ status: "pending_payment" });
      Order.findByPk.mockResolvedValue(order);
      verifyPaystackTransaction.mockResolvedValue({
        data: {
          status: "failed",
          gateway_response: "Insufficient funds",
          metadata: { orderId: order.id },
        },
      });

      const response = await request(app)
        .get("/api/payments/verify/ref-failed")
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
      expect(response.body.orderStatus).toBe("pending_payment");
      expect(order.metadata.payment.status).toBe("failed");
      expect(OrderStatusEvent.create).not.toHaveBeenCalled();
    });

    it("requires exact stored payment reference when falling back from metadata order lookup", async () => {
      const reference = "ELLY-abc12345-1700000000000-abcdef123456";
      const mismatchedOrder = createOrderMock({
        id: "abc12345-0000-0000-0000-000000000000",
        metadata: {
          payment: {
            reference: "ELLY-abc12345-1700000000000-different",
          },
        },
      });

      Order.findByPk.mockResolvedValue(null);
      Order.findAll.mockResolvedValueOnce([mismatchedOrder]).mockResolvedValueOnce([]);
      verifyPaystackTransaction.mockResolvedValue({
        data: {
          status: "success",
          gateway_response: "Successful",
          reference,
          metadata: {},
        },
      });

      const response = await request(app)
        .get(`/api/payments/verify/${reference}`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Order not found for this payment reference.");
      expect(OrderStatusEvent.create).not.toHaveBeenCalled();
    });

    it("settles using fallback candidate when stored payment reference is exact", async () => {
      const reference = "ELLY-abc12345-1700000000000-abcdef123456";
      const matchedOrder = createOrderMock({
        id: "abc12345-0000-0000-0000-000000000000",
        UserId: "user-1",
        status: "pending_payment",
        metadata: {
          payment: {
            reference,
          },
        },
      });

      Order.findByPk.mockResolvedValue(null);
      Order.findAll.mockResolvedValueOnce([matchedOrder]);
      verifyPaystackTransaction.mockResolvedValue({
        data: {
          status: "success",
          gateway_response: "Successful",
          reference,
          metadata: {},
        },
      });

      const response = await request(app)
        .get(`/api/payments/verify/${reference}`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
      expect(response.body.orderStatus).toBe("paid");
      expect(matchedOrder.status).toBe("paid");
    });
  });

  describe("GET /api/orders", () => {
    it("scopes customer list to own orders and uses safe user attributes", async () => {
      const orders = [createOrderMock({ id: "order-safe-1", UserId: "user-1" })];
      Order.findAll.mockResolvedValue(orders);

      const response = await request(app)
        .get("/api/orders")
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(200);
      expect(response.body.orders).toHaveLength(1);
      expect(Order.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { UserId: "user-1" },
          include: expect.arrayContaining([
            expect.objectContaining({
              model: expect.anything(),
              attributes: ["id", "name", "email", "role"],
            }),
          ]),
        })
      );
    });

    it("returns pagination payload when page or limit query is provided", async () => {
      const orders = [createOrderMock({ id: "order-page-1" }), createOrderMock({ id: "order-page-2" })];
      Order.count.mockResolvedValue(5);
      Order.findAll.mockResolvedValue(orders);

      const response = await request(app)
        .get("/api/orders?page=2&limit=2")
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin");

      expect(response.status).toBe(200);
      expect(response.body.orders).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
      expect(Order.count).toHaveBeenCalledWith({ where: {} });
      expect(Order.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 2,
          offset: 2,
          where: {},
        })
      );
    });
  });

  describe("GET /api/orders/:id", () => {
    it("returns order detail for the owner and queries safe user attributes", async () => {
      const order = createOrderMock({ id: "order-detail-1", UserId: "user-1" });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(200);
      expect(response.body.order.id).toBe(order.id);
      expect(Order.findByPk).toHaveBeenCalledWith(
        order.id,
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              model: expect.anything(),
              attributes: ["id", "name", "email", "role"],
            }),
          ]),
        })
      );
    });

    it("blocks customer access to another customer's order", async () => {
      const order = createOrderMock({ id: "order-detail-2", UserId: "user-1" });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-2")
        .set("x-test-role", "customer");

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Access denied.");
    });

    it("allows admin to access any order detail", async () => {
      const order = createOrderMock({ id: "order-detail-3", UserId: "user-1" });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin");

      expect(response.status).toBe(200);
      expect(response.body.order.id).toBe(order.id);
    });

    it("returns 404 when order detail does not exist", async () => {
      Order.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/orders/missing-order")
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Order not found.");
    });
  });

  describe("GET /api/orders/dashboard", () => {
    it("blocks dashboard access for non-admin users", async () => {
      const response = await request(app)
        .get("/api/orders/dashboard")
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "user-1")
        .set("x-test-role", "customer");

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Insufficient permissions.");
    });

    it("returns dashboard KPIs, status counts, and thresholds for admin", async () => {
      const now = new Date();
      const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
      const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

      Order.findAll.mockResolvedValue([
        { id: "ord-1", status: "paid", total: 120000, currency: "GHS", createdAt: hoursAgo(1) },
        { id: "ord-2", status: "shipped", total: 500, currency: "GHS", createdAt: daysAgo(6) },
        { id: "ord-3", status: "fraud_hold", total: 150000, currency: "GHS", createdAt: hoursAgo(30) },
        { id: "ord-4", status: "cancelled", total: 250000, currency: "GHS", createdAt: daysAgo(3) },
        { id: "ord-5", status: "returned", total: 1000, currency: "GHS", createdAt: daysAgo(2) },
        { id: "ord-6", status: "pending", total: 500, currency: "GHS", createdAt: hoursAgo(2) },
      ]);

      const response = await request(app)
        .get("/api/orders/dashboard")
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin");

      expect(response.status).toBe(200);
      expect(response.body.kpis).toEqual({
        totalOrdersToday: 2,
        pendingFulfillment: 2,
        delayedShipments: 1,
        highValueOrders: 3,
        riskFlaggedOrders: 2,
        refundsAwaitingApproval: 2,
      });

      expect(response.body.statusCounts).toEqual(
        expect.objectContaining({
          pending_payment: 1,
          paid: 1,
          shipped: 1,
          cancelled: 1,
          returned: 1,
          fraud_hold: 1,
        })
      );

      expect(response.body.thresholds).toEqual({
        highValueThreshold: 100000,
        delayedShipmentDays: 5,
        pendingRiskHours: 24,
        refundWindowDays: 14,
      });
    });
  });

  describe("POST /api/payments/webhook", () => {
    it("rejects webhook events with an invalid signature", async () => {
      verifyPaystackWebhookSignature.mockReturnValue(false);

      const response = await request(app).post("/api/payments/webhook").send({
        event: "charge.success",
        data: { reference: "ref-1", metadata: { orderId: "order-1" } },
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid webhook signature.");
    });

    it("settles a valid charge.success webhook", async () => {
      const order = createOrderMock({ status: "pending_payment" });
      verifyPaystackWebhookSignature.mockReturnValue(true);
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app).post("/api/payments/webhook").send({
        event: "charge.success",
        data: {
          status: "success",
          gateway_response: "Successful",
          reference: "ref-webhook-success",
          metadata: { orderId: order.id },
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
      expect(order.status).toBe("paid");
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          actorRole: "system",
          toStatus: "paid",
        })
      );
    });
  });

  describe("PATCH /api/orders/:id/status", () => {
    it("allows valid status transitions and emits timeline + notification", async () => {
      const order = createOrderMock({
        status: "processing",
        UserId: "customer-1",
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .patch(`/api/orders/${order.id}/status`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({ status: "packed", note: "Packed by warehouse" });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe("packed");
      expect(order.status).toBe("packed");
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          fromStatus: "processing",
          toStatus: "packed",
          actorRole: "admin",
        })
      );
      expect(OrderNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          UserId: "customer-1",
          status: "packed",
        })
      );
    });

    it("blocks invalid transitions and returns allowed statuses", async () => {
      const order = createOrderMock({ status: "packed" });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .patch(`/api/orders/${order.id}/status`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          status: "delivered",
          note: "Attempted invalid transition during admin review.",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid status transition.");
      expect(response.body.currentStatus).toBe("packed");
      expect(response.body.allowedNextStatuses).toEqual(["shipped", "cancelled"]);
      expect(order.update).not.toHaveBeenCalled();
      expect(OrderStatusEvent.create).not.toHaveBeenCalled();
      expect(OrderNotification.create).not.toHaveBeenCalled();
    });

    it("blocks manual transition into paid status and requires payment workflows", async () => {
      const order = createOrderMock({ status: "pending_payment" });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .patch(`/api/orders/${order.id}/status`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          status: "paid",
          note: "Attempted manual payment mark as paid.",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/manual status updates to paid\/refunded are blocked/i);
      expect(order.update).not.toHaveBeenCalled();
      expect(OrderStatusEvent.create).not.toHaveBeenCalled();
      expect(OrderNotification.create).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/orders/:id/recheck-payment", () => {
    it("allows admin to recheck and settle payment for an order", async () => {
      const order = createOrderMock({
        status: "pending_payment",
        metadata: {
          payment: {
            provider: "paystack",
            reference: "ref-manual-1",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);
      verifyPaystackTransaction.mockResolvedValue({
        data: {
          status: "success",
          gateway_response: "Successful",
          reference: "ref-manual-1",
          metadata: { orderId: order.id },
        },
      });

      const response = await request(app)
        .post(`/api/orders/${order.id}/recheck-payment`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({ internalNote: "Manual payment review requested by operations." });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
      expect(order.status).toBe("paid");
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          toStatus: "paid",
          actorRole: "admin",
        })
      );
    });

    it("returns validation error when order has no payment reference", async () => {
      const order = createOrderMock({
        status: "pending_payment",
        metadata: {},
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/recheck-payment`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({ internalNote: "Manual payment review attempted without reference." });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Payment reference missing for this order. Initialize payment first."
      );
      expect(verifyPaystackTransaction).not.toHaveBeenCalled();
    });

    it("rejects manual payment recheck requests without an internal note", async () => {
      const order = createOrderMock({
        status: "pending_payment",
        metadata: {
          payment: {
            provider: "paystack",
            reference: "ref-manual-2",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/recheck-payment`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Internal note must be at least 10 characters/i);
      expect(verifyPaystackTransaction).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/orders/:id/fraud-review", () => {
    it("places an order on fraud hold with required reason and internal note", async () => {
      const order = createOrderMock({
        status: "pending_payment",
        UserId: "customer-1",
        metadata: {},
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .patch(`/api/orders/${order.id}/fraud-review`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          action: "hold",
          reason: "Suspicious mismatch between billing and delivery details.",
          internalNote: "Placed on hold pending manual fraud verification.",
        });

      expect(response.status).toBe(200);
      expect(order.status).toBe("fraud_hold");
      expect(order.metadata.fraudReview).toEqual(
        expect.objectContaining({
          underReview: true,
          action: "hold",
        })
      );
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          fromStatus: "pending_payment",
          toStatus: "fraud_hold",
          actorRole: "admin",
        })
      );
    });

    it("rejects fraud review actions when internal note is missing", async () => {
      const order = createOrderMock({ status: "pending_payment", metadata: {} });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .patch(`/api/orders/${order.id}/fraud-review`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          action: "hold",
          reason: "Potential fraud risk requires manual hold.",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Internal note must be at least 10 characters/i);
    });
  });

  describe("PATCH /api/orders/:id/operational-data", () => {
    it("updates shipping, contact, and assignment operational fields with internal note", async () => {
      const order = createOrderMock({
        status: "processing",
        shippingAddress: "Old shipping",
        billingAddress: "Old billing",
        metadata: {},
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .patch(`/api/orders/${order.id}/operational-data`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          carrier: "DHL",
          trackingNumber: "TRK-123",
          shipDate: "2026-03-16T10:00:00.000Z",
          deliveryEta: "2026-03-18T12:00:00.000Z",
          customerPhone: "+233555000111",
          deliveryInstructions: "Call before delivery",
          assignmentOwner: "ops.lead",
          assignmentPriority: "high",
          escalationFlag: true,
          internalNote: "Updated operational fields for shipping handoff.",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Operational order data updated.");
      expect(order.metadata.operational.shippingData).toEqual(
        expect.objectContaining({
          carrier: "DHL",
          trackingNumber: "TRK-123",
        })
      );
      expect(order.metadata.operational.contact).toEqual(
        expect.objectContaining({
          phone: "+233555000111",
          deliveryInstructions: "Call before delivery",
        })
      );
      expect(order.metadata.operational.assignment).toEqual(
        expect.objectContaining({
          owner: "ops.lead",
          priority: "high",
          escalationFlag: true,
        })
      );
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          actorRole: "admin",
          note: "Updated operational fields for shipping handoff.",
          metadata: expect.objectContaining({
            action: "operational_data_updated",
          }),
        })
      );
    });

    it("blocks address corrections after shipped state", async () => {
      const order = createOrderMock({
        status: "shipped",
        shippingAddress: "Old shipping",
        billingAddress: "Old billing",
        metadata: {},
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .patch(`/api/orders/${order.id}/operational-data`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          shippingAddress: "New shipping address",
          addressCorrectionReason: "Customer called to correct destination.",
          internalNote: "Attempted address update after shipment.",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/locked after the order reaches shipped state/i);
      expect(order.update).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/orders/:id/refunds", () => {
    it("processes a partial refund with reason code and internal note", async () => {
      const order = createOrderMock({
        status: "processing",
        total: 120,
        metadata: {
          payment: {
            provider: "paystack",
            reference: "ref-123",
            status: "success",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);
      createPaystackRefund.mockResolvedValue({
        data: {
          status: "pending",
          id: "paystack-rf-1",
        },
      });

      const response = await request(app)
        .post(`/api/orders/${order.id}/refunds`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          refundType: "partial",
          amount: 40,
          reasonCode: "customer_request",
          reasonNote: "Customer requested partial compensation.",
          internalNote: "Approved partial refund after escalation review.",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Partial refund processed.");
      expect(order.status).toBe("processing");
      expect(order.metadata.payment.refundedAmount).toBe(40);
      expect(order.metadata.payment.refundStatus).toBe("partial_refund_processed");
      expect(createPaystackRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionReference: "ref-123",
          amountMajor: 40,
          reasonCode: "customer_request",
        })
      );
      expect(Array.isArray(order.metadata.refunds)).toBe(true);
      expect(order.metadata.refunds).toHaveLength(1);
      expect(order.metadata.refunds[0]).toEqual(
        expect.objectContaining({
          type: "partial",
          amount: 40,
          reasonCode: "customer_request",
          processedBy: "admin-1",
          gateway: expect.objectContaining({
            provider: "paystack",
            gatewayReference: "paystack-rf-1",
          }),
        })
      );
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          fromStatus: "processing",
          toStatus: "processing",
          metadata: expect.objectContaining({ action: "refund_partial" }),
        })
      );
    });
  });

  describe("POST /api/orders/:id/adjustments", () => {
    it("adds a line item before fulfillment and recalculates total", async () => {
      const order = createOrderMock({
        status: "processing",
        total: 20,
        metadata: {},
      });
      Order.findByPk.mockResolvedValue(order);
      Product.findByPk.mockResolvedValue({
        id: "product-1",
        price: 15,
      });
      OrderItem.create.mockResolvedValue({
        id: "order-item-2",
        ProductId: "product-1",
        quantity: 1,
        unitPrice: 15,
      });
      OrderItem.findAll.mockResolvedValue([
        { unitPrice: 10, quantity: 2 },
        { unitPrice: 15, quantity: 1 },
      ]);

      const response = await request(app)
        .post(`/api/orders/${order.id}/adjustments`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          action: "add",
          productId: "product-1",
          quantity: 1,
          internalNote: "Added replacement accessory before packing.",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Line item added.");
      expect(order.total).toBe(35);
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          metadata: expect.objectContaining({ action: "order_item_added", recalculatedTotal: 35 }),
        })
      );
    });

    it("blocks adjustments once fulfillment has started", async () => {
      const order = createOrderMock({
        status: "packed",
        metadata: {},
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/adjustments`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          action: "remove",
          orderItemId: "order-item-1",
          internalNote: "Attempted removal after packing completed.",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/only allowed before fulfillment starts/i);
      expect(OrderItem.findOne).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/orders/:id/payment-override", () => {
    it("rejects offline override when feature is disabled", async () => {
      process.env.PAYMENT_OVERRIDE_APPROVERS = "test@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        metadata: {
          payment: {
            status: "pending",
            provider: "offline",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          reasonCode: "offline_bank_transfer",
          approvalReference: "APR-123456",
          internalNote: "Offline transfer was validated during reconciliation.",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/offline payment overrides are disabled/i);
    });

    it("requires allowlisted approver for offline settlement override", async () => {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = "true";
      process.env.PAYMENT_OVERRIDE_APPROVERS = "approver@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        metadata: {
          payment: {
            status: "pending",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          reasonCode: "offline_bank_transfer",
          approvalReference: "APR-123456",
          internalNote: "Offline transfer confirmed by finance and operations.",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/not authorized/i);
    });

    it("creates pending offline override request for approved operator", async () => {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = "true";
      process.env.PAYMENT_OVERRIDE_APPROVERS = "test@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        total: 180,
        UserId: "customer-1",
        metadata: {
          payment: {
            status: "pending",
            provider: "offline",
            reference: "offline-ref-1",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          reasonCode: "offline_bank_transfer",
          approvalReference: "APR-654321",
          internalNote: "Finance approved and validated full offline settlement.",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "Offline payment override request submitted for second approval."
      );
      expect(order.status).toBe("pending_payment");
      expect(order.metadata.payment.status).toBe("pending");
      expect(order.metadata.payment.provider).toBe("offline");
      expect(order.metadata.payment.pendingOfflineOverride).toEqual(
        expect.objectContaining({
          reasonCode: "offline_bank_transfer",
          approvalReference: "APR-654321",
          requestedBy: "admin-1",
        })
      );
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          fromStatus: "pending_payment",
          toStatus: "pending_payment",
          metadata: expect.objectContaining({ action: "offline_payment_override_requested" }),
        })
      );
      expect(OrderNotification.create).not.toHaveBeenCalled();
    });

    it("rejects override when payment provider is not offline", async () => {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = "true";
      process.env.PAYMENT_OVERRIDE_APPROVERS = "test@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        total: 180,
        metadata: {
          payment: {
            status: "pending",
            provider: "paystack",
            reference: "ps-ref-1",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          reasonCode: "offline_bank_transfer",
          approvalReference: "APR-654321",
          internalNote: "Attempted override on non-offline transaction.",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/only be used for offline payment records/i);
    });

    it("rejects reused approval reference across offline overrides", async () => {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = "true";
      process.env.PAYMENT_OVERRIDE_APPROVERS = "test@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        total: 180,
        metadata: {
          payment: {
            status: "pending",
            provider: "offline",
            reference: "offline-ref-1",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);
      Order.findAll.mockResolvedValue([
        {
          id: "other-order",
          metadata: {
            payment: {
              offlineOverride: {
                approvalReference: "APR-654321",
              },
            },
          },
        },
      ]);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-role", "admin")
        .send({
          reasonCode: "offline_bank_transfer",
          approvalReference: "APR-654321",
          internalNote: "Attempted duplicate offline override approval reference.",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/already been used/i);
    });
  });

  describe("POST /api/orders/:id/payment-override/approve", () => {
    it("rejects approval when no pending offline override request exists", async () => {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = "true";
      process.env.PAYMENT_OVERRIDE_APPROVERS = "approver@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        metadata: {
          payment: {
            status: "pending",
            provider: "offline",
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);
      Order.findAll.mockResolvedValue([]);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override/approve`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-2")
        .set("x-test-user-email", "approver@example.com")
        .set("x-test-role", "admin")
        .send({
          internalNote: "Second approver reviewed evidence and attempted approval.",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/no pending offline payment override request/i);
    });

    it("enforces maker-checker by blocking requester from approving own request", async () => {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = "true";
      process.env.PAYMENT_OVERRIDE_APPROVERS = "test@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        metadata: {
          payment: {
            status: "pending",
            provider: "offline",
            pendingOfflineOverride: {
              reasonCode: "offline_bank_transfer",
              approvalReference: "APR-654321",
              amount: 120,
              requestedBy: "admin-1",
              requestedEmail: "test@example.com",
              requestedAt: "2026-03-16T08:00:00.000Z",
              internalNote: "Initial request prepared for secondary approval.",
            },
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override/approve`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-1")
        .set("x-test-user-email", "test@example.com")
        .set("x-test-role", "admin")
        .send({
          internalNote: "Requester attempted to approve their own request.",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/maker-checker control requires a different admin/i);
    });

    it("approves pending offline override with a different allowlisted admin", async () => {
      process.env.ENABLE_OFFLINE_PAYMENT_OVERRIDE = "true";
      process.env.PAYMENT_OVERRIDE_APPROVERS = "requester@example.com,approver@example.com";

      const order = createOrderMock({
        status: "pending_payment",
        total: 180,
        UserId: "customer-1",
        metadata: {
          payment: {
            status: "pending",
            provider: "offline",
            pendingOfflineOverride: {
              reasonCode: "offline_bank_transfer",
              approvalReference: "APR-654321",
              amount: 180,
              requestedBy: "admin-1",
              requestedEmail: "requester@example.com",
              requestedAt: "2026-03-16T08:00:00.000Z",
              internalNote: "Request submitted after finance desk validation.",
            },
          },
        },
      });
      Order.findByPk.mockResolvedValue(order);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payment-override/approve`)
        .set("Authorization", "Bearer test-token")
        .set("x-test-user-id", "admin-2")
        .set("x-test-user-email", "approver@example.com")
        .set("x-test-role", "admin")
        .send({
          internalNote: "Secondary approval completed after document cross-check.",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Offline payment settlement approved and recorded.");
      expect(order.status).toBe("paid");
      expect(order.metadata.payment.status).toBe("success");
      expect(order.metadata.payment.pendingOfflineOverride).toBeNull();
      expect(order.metadata.payment.offlineOverride).toEqual(
        expect.objectContaining({
          reasonCode: "offline_bank_transfer",
          approvalReference: "APR-654321",
          requestedBy: "admin-1",
          approvedBy: "admin-2",
        })
      );
      expect(OrderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          fromStatus: "pending_payment",
          toStatus: "paid",
          metadata: expect.objectContaining({ action: "offline_payment_override_approved" }),
        })
      );
      expect(OrderNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          OrderId: order.id,
          UserId: "customer-1",
          status: "paid",
        })
      );
    });
  });
});
