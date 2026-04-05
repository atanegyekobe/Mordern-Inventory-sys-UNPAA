const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const {
  list,
  create,
  update,
  remove,
} = require("../controllers/categoryController");
const categoryVariantTemplateRoutes = require("./categoryVariantTemplates");

const router = express.Router();

router.use(resolveShopContext);

router.get("/", list);
router.post("/", auth, requireShopAdminAccess, create);
router.patch("/:id", auth, requireShopAdminAccess, update);
router.delete("/:id", auth, requireShopAdminAccess, remove);

// Variant template sub-routes
router.use("/:categoryId/variant-template", categoryVariantTemplateRoutes);

module.exports = router;
