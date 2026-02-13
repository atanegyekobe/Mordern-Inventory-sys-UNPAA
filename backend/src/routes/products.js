const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const upload = require("../config/multer");
const {
  list,
  getById,
  create,
  update,
  remove,
} = require("../controllers/productController");

const router = express.Router();

router.get("/", list);
router.get("/:id", getById);
router.post("/", auth, requireRole("admin"), upload.single("image"), create);
router.patch(
  "/:id",
  auth,
  requireRole("admin"),
  upload.single("image"),
  update
);
router.delete("/:id", auth, requireRole("admin"), remove);

module.exports = router;
