const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");

// All routes are admin-only
router.get(
  "/",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  customerController.getAllCustomers
);
router.get(
  "/stats",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  customerController.getCustomerStats
);
router.get(
  "/:id",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  customerController.getCustomerById
);
router.put(
  "/:id",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  customerController.updateCustomer
);
router.delete(
  "/:id",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  customerController.deleteCustomer
);

module.exports = router;
