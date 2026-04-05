const { Op } = require("sequelize");
const {
  sequelize,
  Product,
  Order,
  OrderItem,
  OrderStatusEvent,
  OfflineSale,
  OfflineSaleItem,
} = require("../models");
const { majorToMinor, ensureMinorInt, minorToMajor } = require("../utils/money");

class PosSaleError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "PosSaleError";
    this.status = status;
  }
}

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PosSaleError(400, "At least one sale item is required.");
  }

  const aggregate = new Map();

  for (const item of items) {
    const productId = String(item?.productId || "").trim();
    const quantity = Number(item?.quantity);

    if (!productId) {
      throw new PosSaleError(400, "Each item must include a productId.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new PosSaleError(400, "Each item quantity must be a positive integer.");
    }

    aggregate.set(productId, (aggregate.get(productId) || 0) + quantity);
  }

  return Array.from(aggregate.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

const ensureOfflineSaleTables = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS offline_sales (
      id UUID PRIMARY KEY,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      total_amount INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL CHECK (status IN ('COMPLETED', 'CANCELLED')),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS offline_sale_items (
      id UUID PRIMARY KEY,
      offline_sale_id UUID NOT NULL REFERENCES offline_sales(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL,
      price_at_sale INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query("CREATE INDEX IF NOT EXISTS idx_offline_sales_shop_id ON offline_sales(shop_id);");
  await sequelize.query("CREATE INDEX IF NOT EXISTS idx_offline_sales_user_id ON offline_sales(user_id);");
  await sequelize.query("CREATE INDEX IF NOT EXISTS idx_offline_sale_items_sale_id ON offline_sale_items(offline_sale_id);");
  await sequelize.query("CREATE INDEX IF NOT EXISTS idx_offline_sale_items_product_id ON offline_sale_items(product_id);");
};

const createPosSale = async ({ shopId, userId, items }) => {
  if (!shopId) {
    throw new PosSaleError(400, "Shop context is required for POS sale.");
  }

  if (!userId) {
    throw new PosSaleError(401, "Authenticated user is required.");
  }

  const normalizedItems = normalizeItems(items);
  await ensureOfflineSaleTables();

  return sequelize.transaction(async (transaction) => {
    const saleLines = [];
    let totalAmount = 0;

    for (const line of normalizedItems) {
      const product = await Product.findOne({
        where: {
          id: line.productId,
          ShopId: shopId,
          status: "active",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!product) {
        throw new PosSaleError(404, `Product ${line.productId} not found for this shop.`);
      }

      if (product.stock < line.quantity) {
        throw new PosSaleError(
          409,
          `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${line.quantity}.`
        );
      }

      const priceAtSale = ensureMinorInt(product.priceMinor || majorToMinor(product.price || 0));
      const costAtPurchase = ensureMinorInt(product.costMinor || majorToMinor(product.cost || 0));
      const lineTotal = priceAtSale * line.quantity;
      totalAmount += lineTotal;

      saleLines.push({
        product,
        productId: product.id,
        productName: product.name,
        quantity: line.quantity,
        priceAtSale,
        costAtPurchase,
        lineTotal,
      });
    }

    const order = await Order.create(
      {
        UserId: userId,
        ShopId: shopId,
        status: "fulfilled",
        total: minorToMajor(totalAmount),
        totalMinor: totalAmount,
        totalPaid: totalAmount,
        balanceDue: 0,
        metadata: {
          source: "POS",
          payment: {
            status: "paid",
            verificationSource: "offline_override",
          },
          pos: {
            payment_status: "PAID",
            order_status: "COMPLETED",
          },
        },
      },
      { transaction }
    );

    await OrderStatusEvent.create(
      {
        OrderId: order.id,
        fromStatus: null,
        toStatus: "fulfilled",
        actorRole: "admin",
        actorUserId: userId,
        note: "Order created from POS quick sale.",
        metadata: {
          source: "POS",
          payment_status: "PAID",
          order_status: "COMPLETED",
        },
      },
      { transaction }
    );

    await OrderItem.bulkCreate(
      saleLines.map((line) => ({
        OrderId: order.id,
        ProductId: line.productId,
        ShopId: shopId,
        quantity: line.quantity,
        unitPrice: minorToMajor(line.priceAtSale),
        unitPriceMinor: line.priceAtSale,
        priceAtPurchase: line.priceAtSale,
        costAtPurchase: line.costAtPurchase,
      })),
      { transaction }
    );

    const sale = await OfflineSale.create(
      {
        ShopId: shopId,
        UserId: userId,
        totalAmount,
        status: "COMPLETED",
      },
      { transaction }
    );

    await OfflineSaleItem.bulkCreate(
      saleLines.map((line) => ({
        OfflineSaleId: sale.id,
        ProductId: line.productId,
        quantity: line.quantity,
        priceAtSale: line.priceAtSale,
      })),
      { transaction }
    );

    for (const line of saleLines) {
      const [updatedRows] = await Product.update(
        {
          stock: sequelize.literal(`stock - ${line.quantity}`),
        },
        {
          where: {
            id: line.productId,
            ShopId: shopId,
            stock: { [Op.gte]: line.quantity },
          },
          transaction,
        }
      );

      if (updatedRows !== 1) {
        throw new PosSaleError(
          409,
          `Stock changed while processing ${line.productName}. Please retry sale.`
        );
      }
    }

    const mergedMetadata = {
      ...(order.metadata || {}),
      pos: {
        ...((order.metadata && order.metadata.pos) || {}),
        offlineSaleId: sale.id,
      },
    };

    await order.update({ metadata: mergedMetadata }, { transaction });

    return {
      order: {
        id: order.id,
        status: order.status,
        totalMinor: order.totalMinor,
        total: order.total,
        source: "POS",
        payment_status: "PAID",
        order_status: "COMPLETED",
        createdAt: order.createdAt,
      },
      sale: {
        id: sale.id,
        shopId: sale.ShopId,
        userId: sale.UserId,
        status: sale.status,
        totalAmountMinor: sale.totalAmount,
        totalAmount: minorToMajor(sale.totalAmount),
        createdAt: sale.createdAt,
      },
      items: saleLines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        priceAtSaleMinor: line.priceAtSale,
        priceAtSale: minorToMajor(line.priceAtSale),
        lineTotalMinor: line.lineTotal,
        lineTotal: minorToMajor(line.lineTotal),
      })),
    };
  });
};

module.exports = {
  PosSaleError,
  createPosSale,
};
