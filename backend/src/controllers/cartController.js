const {
  Cart,
  CartItem,
  Product,
  ProductVariant,
  Order,
  OrderItem,
  OrderStatusEvent,
  Coupon,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const { evaluateOrderFraudRisk } = require("../services/fraudDetectionService");
const { getShopConfig } = require("../services/shopService");
const { majorToMinor, minorToMajor, ensureMinorInt } = require("../utils/money");
const { resolveActiveProductForCart } = require("../services/cartService");

const getOrCreateCart = async (userId, shopId) => {
  const [cart] = await Cart.findOrCreate({
    where: { UserId: userId, ShopId: shopId, status: "open" },
    defaults: { UserId: userId, ShopId: shopId },
  });
  return cart;
};

const summarizeCart = async (cartId, shopId) => {
  const items = await CartItem.findAll({
    where: { CartId: cartId, ShopId: shopId },
    include: [
      {
        model: Product,
        where: { ShopId: shopId },
        required: false,
        include: [{ model: ProductVariant, where: { ShopId: shopId }, required: false }],
      },
      { model: ProductVariant, where: { ShopId: shopId }, required: false },
    ],
  });

  const staleItemIds = items
    .filter((item) => !item.Product)
    .map((item) => item.id);

  if (staleItemIds.length > 0) {
    await CartItem.destroy({ where: { id: staleItemIds, ShopId: shopId } });
  }

  const validItems = items.filter((item) => item.Product);

  const totals = validItems.reduce(
    (acc, item) => {
      const lineTotalMinor = majorToMinor(item.unitPrice) * Number(item.quantity || 0);
      acc.subtotalMinor += lineTotalMinor;
      acc.items += item.quantity;
      return acc;
    },
    { subtotalMinor: 0, items: 0 }
  );

  totals.subtotal = minorToMajor(totals.subtotalMinor);

  return { items: validItems, totals };
};

const summarizeOpenCartsForUser = async (userId) => {
  const carts = await Cart.findAll({
    where: { UserId: userId, status: "open" },
    order: [["createdAt", "ASC"]],
  });

  if (carts.length === 0) {
    return {
      cart: null,
      carts: [],
      items: [],
      totals: { subtotal: 0, items: 0 },
    };
  }

  const combinedItems = [];
  let subtotalMinor = 0;
  let itemsCount = 0;

  for (const cart of carts) {
    const summary = await summarizeCart(cart.id, cart.ShopId);
    combinedItems.push(...summary.items);
    subtotalMinor += summary.totals.subtotalMinor || 0;
    itemsCount += summary.totals.items || 0;
  }

  return {
    cart: carts[0],
    carts,
    items: combinedItems,
    totals: {
      subtotal: minorToMajor(subtotalMinor),
      items: itemsCount,
    },
  };
};

const getCart = async (req, res, next) => {
  try {
    if (!req.shopId) {
      const summary = await summarizeOpenCartsForUser(req.user.id);
      return res.json(summary);
    }

    const cart = await getOrCreateCart(req.user.id, req.shopId);
    const summary = await summarizeCart(cart.id, req.shopId);
    return res.json({ cart, ...summary });
  } catch (error) {
    return next(error);
  }
};

const addItem = async (req, res, next) => {
  try {
    const { productId, variantId, quantity } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ message: "Missing product or quantity." });
    }

    const resolved = await resolveActiveProductForCart({ productId, variantId });
    if (resolved.error) {
      return res.status(404).json({ message: resolved.error });
    }

    const { product, itemPrice, availableStock, shopId: itemShopId } = resolved;

    // Check stock availability
    if (availableStock <= 0) {
      return res.status(400).json({ message: "Item is out of stock." });
    }

    if (quantity > availableStock) {
      return res.status(400).json({ 
        message: `Only ${availableStock} item(s) available in stock.` 
      });
    }

    const cart = await getOrCreateCart(req.user.id, itemShopId);
    
    // Find existing item (same product + same variant)
    const existingQuery = {
      CartId: cart.id,
      ShopId: itemShopId,
      ProductId: productId,
    };
    if (variantId) {
      existingQuery.VariantId = variantId;
    } else {
      existingQuery.VariantId = null;
    }
    
    const existing = await CartItem.findOne({ where: existingQuery });

    // Check if adding more would exceed stock
    const totalQuantity = existing ? existing.quantity + Number(quantity) : Number(quantity);
    if (totalQuantity > availableStock) {
      return res.status(400).json({ 
        message: `Only ${availableStock} item(s) available. Currently have ${existing?.quantity || 0} in cart.` 
      });
    }

    if (existing) {
      await existing.update({ quantity: totalQuantity });
    } else {
      await CartItem.create({
        ShopId: itemShopId,
        CartId: cart.id,
        ProductId: productId,
        VariantId: variantId || null,
        quantity,
        unitPrice: itemPrice,
      });
    }

    const summary = await summarizeCart(cart.id, itemShopId);
    return res.status(201).json({ cart, ...summary });
  } catch (error) {
    return next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const { quantity, variantId } = req.body;
    const { ProductVariant } = require("../models");
    const item = await CartItem.findOne({
      where: { id: req.params.id },
      include: [
        { model: Cart, where: { UserId: req.user.id, status: "open" }, required: true },
        { model: Product, required: false },
      ],
    });

    if (!item) {
      return res.status(404).json({ message: "Cart item not found." });
    }

    const itemShopId = item.ShopId;

    if (!item.Product) {
      await item.destroy();
      return res.status(404).json({ message: "Product no longer exists. Item removed from cart." });
    }

    // If variantId provided, update to new variant
    if (variantId !== undefined) {
      if (variantId) {
        const variant = await ProductVariant.findOne({
          where: { id: variantId, ShopId: itemShopId },
        });
        if (!variant || variant.ProductId !== item.ProductId) {
          return res.status(404).json({ message: "Variant not found for this product." });
        }
        // Check stock availability for new variant
        if (item.quantity > variant.stock) {
          return res.status(400).json({ 
            message: `Only ${variant.stock} item(s) available for this variant in stock.` 
          });
        }
        // Update to new variant and use its price
        const newPrice = variant.price ? variant.price : item.Product.price;
        await item.update({ VariantId: variantId, unitPrice: newPrice });
      } else {
        // Changing to no variant (base product)
        if (item.quantity > item.Product.stock) {
          return res.status(400).json({ 
            message: `Only ${item.Product.stock} item(s) available in stock.` 
          });
        }
        await item.update({ VariantId: null, unitPrice: item.Product.price });
      }
    }

    // Update quantity if provided
    if (quantity !== undefined) {
      const targetVariantId = variantId !== undefined ? variantId : item.VariantId;
      const checkStock = targetVariantId
        ? await ProductVariant.findOne({ where: { id: targetVariantId, ShopId: itemShopId } })
        : item.Product;
      const availableStock = checkStock ? (checkStock.stock || item.Product.stock) : item.Product.stock;
      
      if (quantity > availableStock) {
        return res.status(400).json({ 
          message: `Only ${availableStock} item(s) available in stock.` 
        });
      }

      if (quantity <= 0) {
        await item.destroy();
      } else {
        await item.update({ quantity });
      }
    }

    const summary = await summarizeCart(item.CartId, itemShopId);
    return res.json({ ...summary });
  } catch (error) {
    return next(error);
  }
};

const removeItem = async (req, res, next) => {
  try {
    const item = await CartItem.findOne({
      where: { id: req.params.id },
      include: [{ model: Cart, where: { UserId: req.user.id, status: "open" }, required: true }],
    });
    if (!item) {
      return res.status(404).json({ message: "Cart item not found." });
    }

    const cartId = item.CartId;
    const itemShopId = item.ShopId;
    await item.destroy();
    const summary = await summarizeCart(cartId, itemShopId);
    return res.json({ cartId, ...summary });
  } catch (error) {
    return next(error);
  }
};

const checkout = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const openCarts = await Cart.findAll({
      where: { UserId: req.user.id, status: "open" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (openCarts.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Cart is empty." });
    }

    const cartIds = openCarts.map((cart) => cart.id);

    const cartItems = await CartItem.findAll({
      where: { CartId: cartIds },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (cartItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Cart is empty." });
    }

    // Load product IDs and lock products separately
    const productIds = cartItems.map((item) => item.ProductId);
    const variantIds = cartItems
      .map((item) => item.VariantId)
      .filter((vid) => vid !== null && vid !== undefined);
    
    const products = await Product.findAll({
      where: { id: productIds },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    
    let variants = [];
    if (variantIds.length > 0) {
      variants = await ProductVariant.findAll({
        where: { id: variantIds },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    // Create maps for easy lookup
    const productMap = {};
    products.forEach((p) => {
      productMap[p.id] = p;
    });
    
    const variantMap = {};
    variants.forEach((v) => {
      variantMap[v.id] = v;
    });

    const itemsByShop = new Map();

    for (const item of cartItems) {
      const product = productMap[item.ProductId];
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({ message: "A product in cart no longer exists." });
      }

      if (product.status !== "active") {
        await transaction.rollback();
        return res.status(400).json({
          message: `Product ${product.name} is no longer available.`,
          productId: product.id,
        });
      }

      if (product.ShopId !== item.ShopId) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Cart item shop mismatch detected.",
          cartItemId: item.id,
          productId: product.id,
        });
      }

      if (item.VariantId) {
        const variant = variantMap[item.VariantId];
        if (!variant || variant.ProductId !== item.ProductId || variant.ShopId !== item.ShopId) {
          await transaction.rollback();
          return res.status(400).json({ message: "A variant in cart is invalid." });
        }
      }

      if (!itemsByShop.has(item.ShopId)) {
        itemsByShop.set(item.ShopId, []);
      }
      itemsByShop.get(item.ShopId).push(item);
    }

    const couponByShop = {};
    if (req.body.couponId && req.shopId) {
      couponByShop[req.shopId] = req.body.couponId;
    }

    if (req.body.couponsByShop && typeof req.body.couponsByShop === "object") {
      Object.assign(couponByShop, req.body.couponsByShop);
    }

    const orders = [];

    for (const [shopId, shopItems] of itemsByShop.entries()) {
      const requestedByProductVariant = shopItems.reduce((acc, item) => {
        const key = item.VariantId ? `variant_${item.VariantId}` : `product_${item.ProductId}`;
        acc[key] = (acc[key] || 0) + Number(item.quantity || 0);
        return acc;
      }, {});

      const requestedQuantities = shopItems.reduce((acc, item) => {
        acc[item.ProductId] = (acc[item.ProductId] || 0) + Number(item.quantity || 0);
        return acc;
      }, {});

      for (const [productId, requestedQuantity] of Object.entries(requestedQuantities)) {
        const lockedProduct = productMap[productId];
        if (!lockedProduct || lockedProduct.ShopId !== shopId) {
          await transaction.rollback();
          return res.status(400).json({ message: "A product in cart no longer exists." });
        }

        if (requestedQuantity <= 0) {
          await transaction.rollback();
          return res.status(400).json({ message: "Invalid item quantity in cart." });
        }

        if (lockedProduct.stock < requestedQuantity) {
          await transaction.rollback();
          return res.status(409).json({
            message: `Insufficient stock for ${lockedProduct.name}. Available: ${lockedProduct.stock}, requested: ${requestedQuantity}.`,
            productId,
            available: lockedProduct.stock,
            requested: requestedQuantity,
          });
        }
      }

      for (const [key, requestedQuantity] of Object.entries(requestedByProductVariant)) {
        if (key.startsWith("variant_")) {
          const variantId = key.replace("variant_", "");
          const lockedVariant = variantMap[variantId];
          if (!lockedVariant || lockedVariant.ShopId !== shopId) {
            await transaction.rollback();
            return res.status(400).json({ message: "A variant in cart no longer exists." });
          }

          if (lockedVariant.stock < requestedQuantity) {
            await transaction.rollback();
            return res.status(409).json({
              message: `Insufficient variant stock. Available: ${lockedVariant.stock}, requested: ${requestedQuantity}.`,
              variantId,
              available: lockedVariant.stock,
              requested: requestedQuantity,
            });
          }
        }
      }

      let totalMinor = shopItems.reduce((acc, item) => {
        const unitPriceMinor = majorToMinor(item.unitPrice);
        return acc + unitPriceMinor * Number(item.quantity || 0);
      }, 0);

      const shopConfig = await getShopConfig(shopId);
      const shopCurrency = shopConfig?.branding?.currency || "GHS";

      let couponId = null;
      let discount = 0;
      const selectedCouponId = couponByShop[shopId] || null;

      if (selectedCouponId) {
        const coupon = await Coupon.findOne({
          where: { id: selectedCouponId, ShopId: shopId },
          transaction,
        });

        if (!coupon) {
          await transaction.rollback();
          return res.status(400).json({ message: "Invalid coupon." });
        }

        if (coupon.status !== "active") {
          await transaction.rollback();
          return res.status(400).json({ message: "Coupon is not active." });
        }

        const now = new Date();
        if (coupon.startDate && new Date(coupon.startDate) > now) {
          await transaction.rollback();
          return res.status(400).json({ message: "Coupon is not yet valid." });
        }

        if (coupon.endDate && new Date(coupon.endDate) < now) {
          await transaction.rollback();
          return res.status(400).json({ message: "Coupon has expired." });
        }

        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
          await transaction.rollback();
          return res.status(400).json({ message: "Coupon usage limit reached." });
        }

        const minPurchaseMinor = majorToMinor(coupon.minPurchase || 0);
        if (minPurchaseMinor > 0 && totalMinor < minPurchaseMinor) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Minimum purchase of ${shopCurrency} ${minorToMajor(minPurchaseMinor).toFixed(2)} required.`,
          });
        }

        if (coupon.type === "percentage") {
          const percentageBasisPoints = ensureMinorInt(majorToMinor(coupon.value || 0));
          discount = Math.floor((totalMinor * percentageBasisPoints) / 10000);
          const maxDiscountMinor = coupon.maxDiscount ? majorToMinor(coupon.maxDiscount) : 0;
          if (maxDiscountMinor > 0 && discount > maxDiscountMinor) {
            discount = maxDiscountMinor;
          }
        } else if (coupon.type === "fixed") {
          discount = majorToMinor(coupon.value || 0);
        }

        discount = Math.min(discount, totalMinor);
        totalMinor = totalMinor - discount;
        couponId = coupon.id;

        await coupon.update({ usageCount: coupon.usageCount + 1 }, { transaction });
      }

      const failedPaymentLookbackHours = Math.max(
        1,
        Number(process.env.FRAUD_FAILED_PAYMENT_LOOKBACK_HOURS || 48)
      );
      const lookbackDate = new Date(
        Date.now() - failedPaymentLookbackHours * 60 * 60 * 1000
      );

      const recentOrders = await Order.findAll({
        where: {
          UserId: req.user.id,
          ShopId: shopId,
          createdAt: {
            [Op.gte]: lookbackDate,
          },
        },
        attributes: ["id", "status", "createdAt", "metadata"],
        transaction,
      });

      const fraudReview = evaluateOrderFraudRisk({
        shippingAddress: req.body.shippingAddress ?? "",
        billingAddress: req.body.billingAddress ?? "",
        orderTotal: minorToMajor(totalMinor),
        paymentFailedAttempts: req.body.paymentFailedAttempts,
        recentOrders,
      });

      const initialStatus = fraudReview.underReview ? "fraud_hold" : "pending_payment";

      const order = await Order.create(
        {
          UserId: req.user.id,
          ShopId: shopId,
          status: initialStatus,
          total: minorToMajor(totalMinor),
          totalMinor,
          totalPaid: 0,
          balanceDue: totalMinor,
          currency: shopCurrency,
          shippingAddress: req.body.shippingAddress ?? null,
          billingAddress: req.body.billingAddress ?? null,
          CouponId: couponId,
          metadata: {
            fraudReview,
          },
        },
        { transaction }
      );

      const fraudNote =
        fraudReview.underReview && fraudReview.signals.length > 0
          ? `Order flagged under review: ${fraudReview.signals
              .map((signal) => signal.label)
              .join(", ")}.`
          : "Order created during checkout.";

      await OrderStatusEvent.create(
        {
          OrderId: order.id,
          fromStatus: null,
          toStatus: initialStatus,
          actorRole: fraudReview.underReview ? "system" : "customer",
          actorUserId: req.user.id,
          note: fraudNote,
          metadata: fraudReview.underReview ? { fraudReview } : null,
        },
        { transaction }
      );

      for (const item of shopItems) {
        const unitPriceMinor = majorToMinor(item.unitPrice);
        const product = productMap[item.ProductId];
        const costAtPurchase = ensureMinorInt(
          product?.costMinor ?? majorToMinor(product?.cost || 0)
        );

        await OrderItem.create(
          {
            OrderId: order.id,
            ProductId: item.ProductId,
            quantity: item.quantity,
            unitPrice: minorToMajor(unitPriceMinor),
            unitPriceMinor,
            priceAtPurchase: unitPriceMinor,
            costAtPurchase,
            price: minorToMajor(unitPriceMinor),
            ShopId: shopId,
          },
          { transaction }
        );
      }

      for (const [productId, requestedQuantity] of Object.entries(requestedQuantities)) {
        const [updatedCount] = await Product.update(
          {
            stock: sequelize.literal(`stock - ${Number(requestedQuantity)}`),
          },
          {
            where: {
              id: productId,
              ShopId: shopId,
              stock: {
                [Op.gte]: Number(requestedQuantity),
              },
            },
            transaction,
          }
        );

        if (updatedCount !== 1) {
          throw new Error(`Atomic stock decrement failed for product ${productId}.`);
        }

        const product = productMap[productId];
        if (product && product.stock - requestedQuantity === 0 && product.stock > 0) {
          console.warn(`🚨 ZERO STOCK ALERT: "${product.name}" is now out of stock!`);
        }
      }

      for (const [key, requestedQuantity] of Object.entries(requestedByProductVariant)) {
        if (key.startsWith("variant_")) {
          const variantId = key.replace("variant_", "");
          const [updatedCount] = await ProductVariant.update(
            {
              stock: sequelize.literal(`stock - ${Number(requestedQuantity)}`),
            },
            {
              where: {
                id: variantId,
                ShopId: shopId,
                stock: {
                  [Op.gte]: Number(requestedQuantity),
                },
              },
              transaction,
            }
          );

          if (updatedCount !== 1) {
            throw new Error(`Atomic stock decrement failed for variant ${variantId}.`);
          }
        }
      }

      orders.push(order);
    }

    await CartItem.destroy({ where: { CartId: cartIds }, transaction });
    await Cart.update(
      { status: "converted" },
      { where: { id: cartIds }, transaction }
    );

    const primaryShopId = orders[0]?.ShopId || req.shopId || null;
    let freshCart = null;
    if (primaryShopId) {
      freshCart = await Cart.create(
        { UserId: req.user.id, ShopId: primaryShopId },
        { transaction }
      );
    }

    await transaction.commit();
    return res.status(201).json({
      order: orders[0] || null,
      orders,
      cart: freshCart,
    });
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
