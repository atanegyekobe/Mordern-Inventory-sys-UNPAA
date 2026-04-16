const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const {
	create,
	listMine,
	listMembers,
	addMember,
	removeMember,
} = require("../controllers/shopController");

const router = express.Router();

router.get("/mine", auth, listMine);
router.post("/", auth, create);
router.get("/:shopId/members", auth, resolveShopContext, requireShopAdminAccess, listMembers);
router.post("/:shopId/members", auth, resolveShopContext, requireShopAdminAccess, addMember);
router.delete("/:shopId/members/:userId", auth, resolveShopContext, requireShopAdminAccess, removeMember);

module.exports = router;