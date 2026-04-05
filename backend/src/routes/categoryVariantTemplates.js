const express = require("express");
const auth = require("../middleware/auth");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const categoryVariantTemplateController = require("../controllers/categoryVariantTemplateController");

const router = express.Router({ mergeParams: true });

// GET /categories/:categoryId/variant-template - Get template
router.get("/", categoryVariantTemplateController.getTemplate);

// POST /categories/:categoryId/variant-template - Create or update template (admin only)
router.post(
  "/",
  auth,
  requireShopAdminAccess,
  categoryVariantTemplateController.upsertTemplate
);

// PATCH /categories/:categoryId/variant-template - Update template (admin only)
router.patch(
  "/",
  auth,
  requireShopAdminAccess,
  categoryVariantTemplateController.upsertTemplate
);

// POST /categories/:categoryId/variant-template/validate - Validate variant data
router.post(
  "/validate",
  categoryVariantTemplateController.validateVariant
);

module.exports = router;
