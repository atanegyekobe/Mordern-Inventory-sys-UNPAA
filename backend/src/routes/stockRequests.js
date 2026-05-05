const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopStaffAccess = require("../middleware/requireShopStaffAccess");
const requireStaffOnly = require("../middleware/requireStaffOnly");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const {
  createStockRequest,
  listStockRequests,
  approveStockRequest,
  rejectStockRequest,
} = require("../controllers/stockRequestController");

const router = express.Router();

// Only staff (not admin/owner) can create stock requests - admins use direct stock adjustments
router.post(
  "/",
  auth,
  resolveShopContext,
  requireStaffOnly,
  createStockRequest
);

// Staff see own requests, Admin/Owner can list and approve/reject all requests
router.get(
  "/",
  auth,
  resolveShopContext,
  requireShopStaffAccess,
  listStockRequests
);

router.patch(
  "/:requestId/approve",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  approveStockRequest
);

router.patch(
  "/:requestId/reject",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  rejectStockRequest
);

module.exports = router;
