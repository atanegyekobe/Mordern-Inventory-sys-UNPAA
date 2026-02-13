const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { summary } = require("../controllers/adminController");

const router = express.Router();

router.get("/summary", auth, requireRole("admin"), summary);

module.exports = router;
