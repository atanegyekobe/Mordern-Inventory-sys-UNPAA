const { Order, OrderItem, Product } = require("../models");

const list = async (req, res, next) => {
  try {
    const where = req.user.role === "admin" ? {} : { UserId: req.user.id };
    const orders = await Order.findAll({
      where,
      include: [{ model: OrderItem, include: [{ model: Product }] }],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ orders });
  } catch (error) {
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, include: [{ model: Product }] }],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (req.user.role !== "admin" && order.UserId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    await order.update({ status: req.body.status ?? order.status });
    return res.json({ order });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  getById,
  updateStatus,
};
