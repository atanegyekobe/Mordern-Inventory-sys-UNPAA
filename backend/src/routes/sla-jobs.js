const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const {
  triggerJobs,
  getJobHistory,
  getConfig,
  getObservabilityMetrics,
  controlScheduler,
} = require("../controllers/slaJobController");

// All SLA job routes require admin authentication
router.use(auth);
router.use(resolveShopContext);
router.use(requireShopAdminAccess);

// Manual job trigger
router.post("/trigger", triggerJobs);

// Job execution history
router.get("/history", getJobHistory);

// SLA configuration
router.get("/config", getConfig);

// Observability metrics snapshot
router.get("/metrics", getObservabilityMetrics);

// Scheduler control (start/stop)
router.post("/scheduler", controlScheduler);

module.exports = router;
