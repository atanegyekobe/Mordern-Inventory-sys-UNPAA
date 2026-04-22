const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopAdminAccess = require("../middleware/requireShopAdminAccess");
const upload = require("../config/multer");
const {
	create,
	listMine,
	updateName,
	uploadLogo,
	listMembers,
	addMember,
	removeMember,
} = require("../controllers/shopController");

const router = express.Router();

router.get("/mine", auth, listMine);
router.post("/", auth, create);
router.patch("/:shopId", auth, resolveShopContext, requireShopAdminAccess, updateName);
router.post("/:shopId/logo", auth, resolveShopContext, requireShopAdminAccess, upload.single("logo"), uploadLogo);
router.get("/:shopId/members", auth, resolveShopContext, requireShopAdminAccess, listMembers);
router.post("/:shopId/members", auth, resolveShopContext, requireShopAdminAccess, addMember);
router.delete("/:shopId/members/:userId", auth, resolveShopContext, requireShopAdminAccess, removeMember);

module.exports = router;