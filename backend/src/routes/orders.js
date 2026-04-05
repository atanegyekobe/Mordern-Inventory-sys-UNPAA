const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const { validateOrderStatusPayload } = require("../middleware/orderStatusValidation");
const {
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
} = require("../controllers/orderController");

const router = express.Router();

router.get("/dashboard", auth, resolveShopContext, requireShopAdminAccess, dashboard);
router.get("/", auth, resolveShopContext, list);
router.get("/:id", auth, resolveShopContext, getById);
router.patch("/:id/status", auth, resolveShopContext, validateOrderStatusPayload, updateStatus);
router.patch("/:id/automation-override", auth, resolveShopContext, requireShopAdminAccess, setAutomationOverride);
router.patch("/:id/fraud-review", auth, resolveShopContext, requireShopAdminAccess, setFraudReviewState);
router.patch("/:id/operational-data", auth, resolveShopContext, requireShopAdminAccess, setOperationalData);
router.post("/:id/recheck-payment", auth, resolveShopContext, requireShopAdminAccess, recheckPayment);
router.post("/:id/refunds", auth, resolveShopContext, requireShopAdminAccess, createRefund);
router.post("/:id/adjustments", auth, resolveShopContext, requireShopAdminAccess, adjustOrderItems);
router.post("/:id/payment-override", auth, resolveShopContext, requireShopAdminAccess, applyOfflinePaymentOverride);
router.post("/:id/payment-override/approve", auth, resolveShopContext, requireShopAdminAccess, approveOfflinePaymentOverride);

module.exports = router;
