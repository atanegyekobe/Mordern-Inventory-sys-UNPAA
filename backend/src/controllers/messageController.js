const { Message, MessageReply, User, UserShop } = require("../models");
const { Op } = require("sequelize");

// Get all messages (different views for admin vs customer)
exports.getAllMessages = async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const where = { ShopId: req.shopId };

    // If not admin, only show user's own messages
    if (req.user.role !== "admin") {
      where.UserId = req.user.id;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where[Op.or] = [
        { subject: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const messages = await Message.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
        {
          model: MessageReply,
          include: [
            {
              model: User,
              attributes: ["id", "name", "email", "role"],
            },
          ],
          order: [["createdAt", "ASC"]],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// Get single message by ID
exports.getMessageById = async (req, res) => {
  try {
    const message = await Message.findOne({
      where: { id: req.params.id, ShopId: req.shopId },
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
        {
          model: MessageReply,
          include: [
            {
              model: User,
              attributes: ["id", "name", "email", "role"],
            },
          ],
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check authorization - non-admins can only view their own messages
    if (req.user.role !== "admin" && message.UserId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({ error: "Failed to fetch message" });
  }
};

// (Deprecated) admin-specific create — delegates to unified createMessage
exports.createAdminMessage = async (req, res) => {
  return exports.createMessage(req, res);
};

// Unified create message endpoint
exports.createMessage = async (req, res) => {
  try {
    const { userId, subject, content, priority } = req.body;

    // If admin provided a target userId, treat this as admin->customer send
    if (req.user.role === "admin" && userId) {
      if (!subject || !content) {
        return res.status(400).json({ error: "subject and content are required" });
      }

      const targetUser = await User.findByPk(userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      const membership = await UserShop.findOne({ where: { UserId: userId, ShopId: req.shopId } });
      if (!membership) return res.status(404).json({ error: "User not found in this shop" });

      const message = await Message.create({
        ShopId: req.shopId,
        subject,
        content,
        priority: priority || "medium",
        status: "open",
        UserId: userId,
      });

      const createdMessage = await Message.findByPk(message.id, {
        include: [{ model: User, attributes: ["id", "name", "email"] }],
      });

      return res.status(201).json(createdMessage);
    }

    // Otherwise create a message on behalf of the authenticated user
    if (!subject || !content) {
      return res.status(400).json({ error: "Subject and content are required" });
    }

    const message = await Message.create({
      ShopId: req.shopId,
      subject,
      content,
      priority: priority || "medium",
      status: "open",
      UserId: req.user.id,
    });

    const createdMessage = await Message.findByPk(message.id, {
      include: [{ model: User, attributes: ["id", "name", "email"] }],
    });

    res.status(201).json(createdMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
};

// Update message status (admin)
exports.updateMessageStatus = async (req, res) => {
  try {
    const { status, priority } = req.body;

    const message = await Message.findOne({ where: { id: req.params.id, ShopId: req.shopId } });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Validate status
    const validStatuses = ["open", "replied", "closed"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Validate priority
    const validPriorities = ["low", "medium", "high"];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }

    await message.update({
      status: status || message.status,
      priority: priority || message.priority,
    });

    res.json(message);
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ error: "Failed to update message" });
  }
};

// Delete message (admin)
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findOne({ where: { id: req.params.id, ShopId: req.shopId } });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    await message.destroy();
    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
};

// Add reply to message
exports.addReply = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Reply content is required" });
    }

    const message = await Message.findOne({
      where: { id: req.params.id, ShopId: req.shopId },
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check authorization - customers can only reply to their own messages
    if (req.user.role !== "admin" && message.UserId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const isAdminReply = req.user.role === "admin";

    const reply = await MessageReply.create({
      content,
      isAdminReply,
      MessageId: message.id,
      UserId: req.user.id,
    });

    // Update message status to "replied" if admin replies
    if (isAdminReply && message.status === "open") {
      await message.update({ status: "replied" });
    }

    // Fetch the created reply with user info
    const createdReply = await MessageReply.findByPk(reply.id, {
      include: [
        {
          model: User,
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    res.status(201).json(createdReply);
  } catch (error) {
    console.error("Error adding reply:", error);
    res.status(500).json({ error: "Failed to add reply" });
  }
};

// Get message statistics (admin)
exports.getMessageStats = async (req, res) => {
  try {
    const [totalMessages, openMessages, repliedMessages, closedMessages, highPriorityMessages] = await Promise.all([
      Message.count({ where: { ShopId: req.shopId } }),
      Message.count({ where: { ShopId: req.shopId, status: "open" } }),
      Message.count({ where: { ShopId: req.shopId, status: "replied" } }),
      Message.count({ where: { ShopId: req.shopId, status: "closed" } }),
      Message.count({ where: { ShopId: req.shopId, priority: "high" } }),
    ]);

    res.json({
      total: totalMessages,
      open: openMessages,
      replied: repliedMessages,
      closed: closedMessages,
      highPriority: highPriorityMessages,
    });
  } catch (error) {
    console.error("Error fetching message stats:", error);
    res.status(500).json({ error: "Failed to fetch message statistics" });
  }
};

// Mark message as read
exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findOne({ where: { id: req.params.id, ShopId: req.shopId } });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check authorization - customers can only mark their own messages as read
    if (req.user.role !== "admin" && message.UserId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Only mark as read if it hasn't been read yet
    if (!message.readAt) {
      await message.update({ readAt: new Date() });
    }

    res.json(message);
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const where = {
      readAt: null,
      ShopId: req.shopId,
    };

    // If not admin, only count user's own unread messages
    if (req.user.role !== "admin") {
      where.UserId = req.user.id;
    }

    const unreadCount = await Message.count({ where });

    res.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
};
