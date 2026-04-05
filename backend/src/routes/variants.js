const express = require("express");
const variantController = require("../controllers/variantController");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");

const router = express.Router({ mergeParams: true });

// All variant routes require authentication
// GET /products/:productId/variants - Get all variants for a product
router.get("/", variantController.getVariantsByProduct);

// GET /products/:productId/variants/:variantId - Get specific variant
router.get("/:variantId", variantController.getVariant);

// GET /products/:productId/variants/search - Get variant by SKU or attributes
router.get("/search", variantController.getVariantBySkuOrAttributes);

// POST /products/:productId/variants - Create variant (admin only)
router.post(
  "/",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  variantController.createVariant
);

// PATCH /products/:productId/variants/:variantId - Update variant (admin only)
router.patch(
  "/:variantId",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  variantController.updateVariant
);

// DELETE /products/:productId/variants/:variantId - Delete variant (admin only)
router.delete(
  "/:variantId",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  variantController.deleteVariant
);

// PATCH /products/:productId/variants/:variantId/stock - Update variant stock (admin only)
router.patch(
  "/:variantId/stock",
  auth,
  resolveShopContext,
  requireShopAdminAccess,
  variantController.updateVariantStock
);

module.exports = router;
