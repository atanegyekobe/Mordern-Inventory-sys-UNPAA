const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const { listProducts, searchProducts, createSale } = require("../controllers/posController");

const router = express.Router();

router.get("/products", auth, resolveShopContext, requireShopAdminAccess, listProducts);
router.get("/products/search", auth, resolveShopContext, requireShopAdminAccess, searchProducts);
router.post("/sale", auth, resolveShopContext, requireShopAdminAccess, createSale);

module.exports = router;
