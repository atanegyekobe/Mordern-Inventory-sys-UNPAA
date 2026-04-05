const express = require("express");
const auth = require("../middleware/auth");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const { reconciliationReport } = require("../controllers/adminController");

const router = express.Router();

router.get("/report", auth, requireShopAdminAccess, reconciliationReport);

module.exports = router;
