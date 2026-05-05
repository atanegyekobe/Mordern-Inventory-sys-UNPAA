const express = require("express");
const authRoutes = require("./auth");
const shopRoutes = require("./shops");
const categoryRoutes = require("./categories");
const productRoutes = require("./products");
const adminRoutes = require("./admin");
const customerRoutes = require("./customers");
const aiRoutes = require("./ai");
const posRoutes = require("./pos");
const stockRequestRoutes = require("./stockRequests");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/shops", shopRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/admin", adminRoutes);
router.use("/customers", customerRoutes);
router.use("/ai", aiRoutes);
router.use("/pos", posRoutes);
router.use("/stock-requests", stockRequestRoutes);

module.exports = router;
