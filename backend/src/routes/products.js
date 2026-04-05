const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const upload = require("../config/multer");
const variantRoutes = require("./variants");

const {
  listPublic,
  getPublicBySlug,
  getPublicById,
  list,
  getById,
  getBySlug,
  create,
  update,
  remove,
  bulkUpdatePrice,
  bulkUpdateCategory,
  bulkUpdateStock,
  bulkUpdateStatus,
  bulkDelete,
} = require("../controllers/productController");

const { validateBody } = require("../middleware/zodValidate");
const {
  productSchema,
  productUpdateSchema,
  bulkPriceSchema,
  bulkCategorySchema,
  bulkStockSchema,
  bulkStatusSchema,
  bulkDeleteSchema,
} = require("../validationSchemas");

const router = express.Router();

// Public marketplace endpoints (no authentication required)
router.get("/public", listPublic);
router.get("/public/slug/:slug", getPublicBySlug);
router.get("/public/:productId", getPublicById);

// Shop-aware product routes
router.use(resolveShopContext);

// Variant sub-routes
router.use("/:productId/variants", variantRoutes);

// Bulk operations
router.patch(
  "/bulk/price",
  auth,
  requireShopAdminAccess,
  validateBody(bulkPriceSchema),
  bulkUpdatePrice
);
router.patch(
  "/bulk/category",
  auth,
  requireShopAdminAccess,
  validateBody(bulkCategorySchema),
  bulkUpdateCategory
);
router.patch(
  "/bulk/stock",
  auth,
  requireShopAdminAccess,
  validateBody(bulkStockSchema),
  bulkUpdateStock
);
router.patch(
  "/bulk/status",
  auth,
  requireShopAdminAccess,
  validateBody(bulkStatusSchema),
  bulkUpdateStatus
);
router.delete(
  "/bulk",
  auth,
  requireShopAdminAccess,
  validateBody(bulkDeleteSchema),
  bulkDelete
);

// Single operations
router.get("/", list);
router.get("/slug/:slug", getBySlug);
router.get("/:id", getById);
router.post(
  "/",
  auth,
  requireShopAdminAccess,
  upload.single("image"),
  validateBody(productSchema),
  create
);
router.patch(
  "/:id",
  auth,
  requireShopAdminAccess,
  upload.single("image"),
  validateBody(productUpdateSchema),
  update
);
router.delete("/:id", auth, requireShopAdminAccess, remove);

module.exports = router;
