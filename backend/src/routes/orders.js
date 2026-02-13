const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { list, getById, updateStatus } = require("../controllers/orderController");

const router = express.Router();

router.get("/", auth, list);
router.get("/:id", auth, getById);
router.patch("/:id/status", auth, requireRole("admin"), updateStatus);

module.exports = router;
