const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const orderNotificationController = require("../controllers/orderNotificationController");

const router = express.Router();

router.get("/", auth, resolveShopContext, orderNotificationController.list);
router.get("/unread/count", auth, resolveShopContext, orderNotificationController.getUnreadCount);
router.post("/read-all", auth, resolveShopContext, orderNotificationController.markAllAsRead);
router.post("/:id/read", auth, resolveShopContext, orderNotificationController.markAsRead);

module.exports = router;
