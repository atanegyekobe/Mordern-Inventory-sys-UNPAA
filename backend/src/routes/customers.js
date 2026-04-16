const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopStaffAccess = require("../middleware/requireShopStaffAccess");

// Operational customer routes are available to OWNER/STAFF
router.get(
  "/",
  auth,
  resolveShopContext,
  requireShopStaffAccess,
  customerController.getAllCustomers
);
router.get(
  "/stats",
  auth,
  resolveShopContext,
  requireShopStaffAccess,
  customerController.getCustomerStats
);
router.get(
  "/:id",
  auth,
  resolveShopContext,
  requireShopStaffAccess,
  customerController.getCustomerById
);
router.put(
  "/:id",
  auth,
  resolveShopContext,
  requireShopStaffAccess,
  customerController.updateCustomer
);
router.delete(
  "/:id",
  auth,
  resolveShopContext,
  requireShopStaffAccess,
  customerController.deleteCustomer
);

module.exports = router;
