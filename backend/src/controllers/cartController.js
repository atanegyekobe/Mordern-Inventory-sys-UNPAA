const { Cart, CartItem, Product, Order, OrderItem, sequelize } = require("../models");

const getOrCreateCart = async (userId) => {
  const [cart] = await Cart.findOrCreate({
    where: { UserId: userId, status: "open" },
    defaults: { UserId: userId },
  });
  return cart;
};

const summarizeCart = async (cartId) => {
  const items = await CartItem.findAll({
    where: { CartId: cartId },
    include: [{ model: Product }],
  });

  const totals = items.reduce(
    (acc, item) => {
      const lineTotal = Number(item.unitPrice) * item.quantity;
      acc.subtotal += lineTotal;
      acc.items += item.quantity;
      return acc;
    },
    { subtotal: 0, items: 0 }
  );

  return { items, totals };
};

const getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    const summary = await summarizeCart(cart.id);
    return res.json({ cart, ...summary });
  } catch (error) {
    return next(error);
  }
};

const addItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ message: "Missing product or quantity." });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const cart = await getOrCreateCart(req.user.id);
    const existing = await CartItem.findOne({
      where: { CartId: cart.id, ProductId: productId },
    });

    if (existing) {
      await existing.update({ quantity: existing.quantity + Number(quantity) });
    } else {
      await CartItem.create({
        CartId: cart.id,
        ProductId: productId,
        quantity,
        unitPrice: product.price,
      });
    }

    const summary = await summarizeCart(cart.id);
    return res.status(201).json({ cart, ...summary });
  } catch (error) {
    return next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const item = await CartItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Cart item not found." });
    }

    await item.update({ quantity });
    const summary = await summarizeCart(item.CartId);
    return res.json({ cartId: item.CartId, ...summary });
  } catch (error) {
    return next(error);
  }
};

const removeItem = async (req, res, next) => {
  try {
    const item = await CartItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Cart item not found." });
    }

    const cartId = item.CartId;
    await item.destroy();
    const summary = await summarizeCart(cartId);
    return res.json({ cartId, ...summary });
  } catch (error) {
    return next(error);
  }
};

const checkout = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const cart = await getOrCreateCart(req.user.id);
    const cartItems = await CartItem.findAll({
      where: { CartId: cart.id },
      include: [{ model: Product }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (cartItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Cart is empty." });
    }

    const total = cartItems.reduce(
      (acc, item) => acc + Number(item.unitPrice) * item.quantity,
      0
    );

    const order = await Order.create(
      {
        UserId: req.user.id,
        total,
        shippingAddress: req.body.shippingAddress ?? null,
        billingAddress: req.body.billingAddress ?? null,
      },
      { transaction }
    );

    for (const item of cartItems) {
      await OrderItem.create(
        {
          OrderId: order.id,
          ProductId: item.ProductId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        },
        { transaction }
      );

      const product = item.Product;
      await product.update(
        { stock: Math.max(product.stock - item.quantity, 0) },
        { transaction }
      );
    }

    await CartItem.destroy({ where: { CartId: cart.id }, transaction });
    await cart.update({ status: "converted" }, { transaction });

    const freshCart = await Cart.create(
      { UserId: req.user.id },
      { transaction }
    );

    await transaction.commit();
    return res.status(201).json({ order, cart: freshCart });
  } catch (error) {
    await transaction.rollback();
    return next(error);
  }
};

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  checkout,
};
