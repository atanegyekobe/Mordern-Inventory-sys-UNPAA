const { OrderNotification, Order } = require("../models");

exports.list = async (req, res) => {
  try {
    const where = {};

    if (req.user.role !== "admin") {
      where.UserId = req.user.id;
    }

    where.ShopId = req.shopId;

    const notifications = await OrderNotification.findAll({
      where,
      include: [
        {
          model: Order,
          attributes: ["id", "status", "createdAt"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching order notifications:", error);
    res.status(500).json({ error: "Failed to fetch order notifications" });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const where = {
      readAt: null,
      ShopId: req.shopId,
    };

    if (req.user.role !== "admin") {
      where.UserId = req.user.id;
    }

    const unreadCount = await OrderNotification.count({ where });

    res.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching order notification count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await OrderNotification.findOne({ where: { id: req.params.id, ShopId: req.shopId } });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (req.user.role !== "admin" && notification.UserId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!notification.readAt) {
      await notification.update({ readAt: new Date() });
    }

    res.json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const where = {
      readAt: null,
      ShopId: req.shopId,
    };

    if (req.user.role !== "admin") {
      where.UserId = req.user.id;
    }

    await OrderNotification.update(
      { readAt: new Date() },
      {
        where,
      }
    );

    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
};
