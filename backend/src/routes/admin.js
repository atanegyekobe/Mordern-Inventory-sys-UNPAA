const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const requireShopStaffAccess = require("../middleware/requireShopStaffAccess");
const { uploadCsv } = require("../config/multer");
const {
	summary,
	analytics,
	salesManagement,
	getLowStockAlerts,
	listStockMovements,
	listStockLots,
} = require("../controllers/adminController");
const { previewImport, executeImport } = require("../controllers/importController");

const router = express.Router();

router.get("/summary", auth, resolveShopContext, requireShopStaffAccess, summary);
router.get("/analytics", auth, resolveShopContext, requireShopAdminAccess, analytics);
router.get("/sales-management", auth, resolveShopContext, requireShopStaffAccess, salesManagement);
router.get("/low-stock-alerts", auth, resolveShopContext, requireShopStaffAccess, getLowStockAlerts);
router.get("/stock-movements", auth, resolveShopContext, requireShopStaffAccess, listStockMovements);
router.get("/stock-lots", auth, resolveShopContext, requireShopStaffAccess, listStockLots);

// CSV Import routes
router.post("/products/import/preview", auth, resolveShopContext, requireShopAdminAccess, uploadCsv.single("file"), previewImport);
router.post("/products/import/execute", auth, resolveShopContext, requireShopAdminAccess, executeImport);

module.exports = router;
