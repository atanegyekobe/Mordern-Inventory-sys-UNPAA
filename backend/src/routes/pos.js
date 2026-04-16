const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopStaffAccess = require("../middleware/requireShopStaffAccess");
const {
	listProducts,
	searchProducts,
	createSale,
	listRecentSales,
	getRecentSaleDetails,
} = require("../controllers/posController");

const router = express.Router();

router.get("/products", auth, resolveShopContext, requireShopStaffAccess, listProducts);
router.get("/products/search", auth, resolveShopContext, requireShopStaffAccess, searchProducts);
router.get("/recent-sales", auth, resolveShopContext, requireShopStaffAccess, listRecentSales);
router.get("/recent-sales/:saleId", auth, resolveShopContext, requireShopStaffAccess, getRecentSaleDetails);
router.post("/sale", auth, resolveShopContext, requireShopStaffAccess, createSale);

module.exports = router;
