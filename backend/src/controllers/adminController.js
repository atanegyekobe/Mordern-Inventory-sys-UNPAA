const { User, Product, Order } = require("../models");

const summary = async (req, res, next) => {
  try {
    const [users, products, orders] = await Promise.all([
      User.count(),
      Product.count(),
      Order.count(),
    ]);

    return res.json({ users, products, orders });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  summary,
};
