const { Op } = require("sequelize");
const {
  sequelize,
  Product,
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

const normalizeSaleNote = (note) => {
  if (note === undefined || note === null) {
    return null;
  }

  const value = String(note).trim();
  if (!value) {
    return null;
  }

  return value.slice(0, 280);
};

const ensureOfflineSaleTables = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS offline_sales (
      id UUID PRIMARY KEY,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      total_amount INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL CHECK (status IN ('COMPLETED', 'CANCELLED')),
      note VARCHAR(280),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query("ALTER TABLE offline_sales ADD COLUMN IF NOT EXISTS note VARCHAR(280);");

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

const createPosSale = async ({ shopId, userId, items, note }) => {
  if (!shopId) {
    throw new PosSaleError(400, "Shop context is required for POS sale.");
  }

  if (!userId) {
    throw new PosSaleError(401, "Authenticated user is required.");
  }

  const normalizedItems = normalizeItems(items);
  const normalizedNote = normalizeSaleNote(note);
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

    const sale = await OfflineSale.create(
      {
        ShopId: shopId,
        UserId: userId,
        totalAmount,
        status: "COMPLETED",
        note: normalizedNote,
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

    return {
      order: {
        id: sale.id,
        status: "completed",
        totalMinor: sale.totalAmount,
        total: minorToMajor(sale.totalAmount),
        source: "POS",
        payment_status: "PAID",
        order_status: "COMPLETED",
        createdAt: sale.createdAt,
      },
      sale: {
        id: sale.id,
        shopId: sale.ShopId,
        userId: sale.UserId,
        status: sale.status,
        note: sale.note || null,
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
