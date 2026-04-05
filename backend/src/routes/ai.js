const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const { productDraft } = require("../controllers/aiController");

const router = express.Router();

router.post("/product-draft", auth, resolveShopContext, requireShopAdminAccess, productDraft);

module.exports = router;
