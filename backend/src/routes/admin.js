const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const { uploadCsv } = require("../config/multer");
const { summary, analytics, salesManagement, getLowStockAlerts, reconciliationReport } = require("../controllers/adminController");
const { previewImport, executeImport } = require("../controllers/importController");

const router = express.Router();

router.get("/reconciliation/report", auth, resolveShopContext, requireShopAdminAccess, reconciliationReport);
router.get("/summary", auth, resolveShopContext, requireShopAdminAccess, summary);
router.get("/analytics", auth, resolveShopContext, requireShopAdminAccess, analytics);
router.get("/sales-management", auth, resolveShopContext, requireShopAdminAccess, salesManagement);
router.get("/low-stock-alerts", auth, resolveShopContext, requireShopAdminAccess, getLowStockAlerts);

// CSV Import routes
router.post("/products/import/preview", auth, resolveShopContext, requireShopAdminAccess, uploadCsv.single("file"), previewImport);
router.post("/products/import/execute", auth, resolveShopContext, requireShopAdminAccess, executeImport);

module.exports = router;
