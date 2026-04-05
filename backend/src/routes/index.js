const express = require("express");
const authRoutes = require("./auth");
const shopRoutes = require("./shops");
const categoryRoutes = require("./categories");
const productRoutes = require("./products");
const cartRoutes = require("./cart");
const orderRoutes = require("./orders");
const adminRoutes = require("./admin");
const couponRoutes = require("./coupons");
const messageRoutes = require("./messages");
const orderNotificationRoutes = require("./order-notifications");
const customerRoutes = require("./customers");
const aiRoutes = require("./ai");
const slaJobRoutes = require("./sla-jobs");
const paymentRoutes = require("./payments");
const reconciliationRoutes = require("./reconciliation");
const posRoutes = require("./pos");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/shops", shopRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/admin", adminRoutes);
router.use("/coupons", couponRoutes);
router.use("/messages", messageRoutes);
router.use("/order-notifications", orderNotificationRoutes);
router.use("/customers", customerRoutes);
router.use("/ai", aiRoutes);
router.use("/sla-jobs", slaJobRoutes);
router.use("/payments", paymentRoutes);
router.use("/reconciliation", reconciliationRoutes);
router.use("/pos", posRoutes);

module.exports = router;
