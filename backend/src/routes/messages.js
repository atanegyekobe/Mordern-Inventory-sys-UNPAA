const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const requireShopStaffAccess = require("../middleware/requireShopStaffAccess");

// All authenticated users can access these routes
router.get("/", auth, resolveShopContext, messageController.getAllMessages);
router.get("/unread/count", auth, resolveShopContext, messageController.getUnreadCount);
router.get("/:id", auth, resolveShopContext, messageController.getMessageById);
router.post("/", auth, resolveShopContext, messageController.createMessage);
router.post("/:id/read", auth, resolveShopContext, messageController.markAsRead);

// Admin-only: create message to any customer
router.post("/admin/send", auth, resolveShopContext, requireShopStaffAccess, messageController.createAdminMessage);

router.post("/:id/replies", auth, resolveShopContext, messageController.addReply);

router.get("/stats/summary", auth, resolveShopContext, requireShopStaffAccess, messageController.getMessageStats);

// Admin-only routes
router.put("/:id/status", auth, resolveShopContext, requireShopStaffAccess, messageController.updateMessageStatus);
router.delete("/:id", auth, resolveShopContext, requireShopStaffAccess, messageController.deleteMessage);

module.exports = router;
