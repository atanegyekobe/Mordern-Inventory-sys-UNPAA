const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  list,
  create,
  update,
  remove,
} = require("../controllers/categoryController");

const router = express.Router();

router.get("/", list);
router.post("/", auth, requireRole("admin"), create);
router.patch("/:id", auth, requireRole("admin"), update);
router.delete("/:id", auth, requireRole("admin"), remove);

module.exports = router;
