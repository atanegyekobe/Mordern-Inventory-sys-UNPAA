const express = require("express");
const router = express.Router();
const couponController = require("../controllers/couponController");
const auth = require("../middleware/auth");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const { resolveShopContext } = require("../middleware/shopContext");

// Admin routes
router.get("/", auth, resolveShopContext, requireShopAdminAccess, couponController.getAllCoupons);
router.get("/:id", auth, resolveShopContext, requireShopAdminAccess, couponController.getCouponById);
router.post("/", auth, resolveShopContext, requireShopAdminAccess, couponController.createCoupon);
router.put("/:id", auth, resolveShopContext, requireShopAdminAccess, couponController.updateCoupon);
router.delete(
  "/:id",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  couponController.deleteCoupon
);

// User route - validate coupon
router.post("/validate", auth, resolveShopContext, couponController.validateCoupon);

module.exports = router;
