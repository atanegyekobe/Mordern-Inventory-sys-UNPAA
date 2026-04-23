const { Op } = require("sequelize");
const {
  Product,
  Category,
  OfflineSale,
  OfflineSaleItem,
  OfflineSaleItemLotAllocation,
  InventoryLot,
  User,
} = require("../models");
const { createPosSale, PosSaleError } = require("../services/posSaleService");
const { minorToMajor } = require("../utils/money");

const POS_SEARCH_LIMIT = 20;
const POS_RECENT_SALES_LIMIT = 5;

const listProducts = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: {
        ShopId: req.shopId,
        status: "active",
      },
      attributes: ["id", "name", "price", "stock", "imageUrl", "CategoryId"],
      include: [{ model: Category, attributes: ["id", "name"], required: false }],
      order: [["name", "ASC"]],
    });

    return res.json({
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        image: product.imageUrl,
        CategoryId: product.CategoryId || null,
        Category: product.Category
          ? {
              id: product.Category.id,
              name: product.Category.name,
            }
          : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const searchProducts = async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.json({ products: [] });
    }

    const products = await Product.findAll({
      where: {
        ShopId: req.shopId,
        status: "active",
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { sku: { [Op.iLike]: `%${query}%` } },
        ],
      },
      attributes: ["id", "name", "price", "stock", "imageUrl", "CategoryId"],
      include: [{ model: Category, attributes: ["id", "name"], required: false }],
      order: [["name", "ASC"]],
      limit: POS_SEARCH_LIMIT,
    });

    return res.json({
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        image: product.imageUrl,
        CategoryId: product.CategoryId || null,
        Category: product.Category
          ? {
              id: product.Category.id,
              name: product.Category.name,
            }
          : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const createSale = async (req, res, next) => {
  try {
    const payload = await createPosSale({
      shopId: req.shopId,
      userId: req.user?.id,
      items: req.body?.items,
      note: req.body?.note,
    });

    return res.status(201).json(payload);
  } catch (error) {
    if (error instanceof PosSaleError) {
      return res.status(error.status).json({ message: error.message });
    }

    return next(error);
  }
};

const listRecentSales = async (req, res, next) => {
  try {
    const sales = await OfflineSale.findAll({
      where: {
        ShopId: req.shopId,
      },
      attributes: ["id", "totalAmount", "status", "createdAt", "note"],
      include: [
        {
          model: OfflineSaleItem,
          attributes: ["quantity"],
        },
        {
          model: User,
          attributes: ["id", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: POS_RECENT_SALES_LIMIT,
    });

    return res.json({
      sales: sales.map((sale) => ({
        id: sale.id,
        totalAmountMinor: sale.totalAmount,
        totalAmount: minorToMajor(sale.totalAmount),
        status: sale.status,
        note: sale.note || null,
        createdAt: sale.createdAt,
        cashier: sale.User
          ? {
              id: sale.User.id,
              name: sale.User.name,
            }
          : null,
        itemCount: (sale.OfflineSaleItems || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const getRecentSaleDetails = async (req, res, next) => {
  try {
    const saleId = String(req.params.saleId || "").trim();

    const sale = await OfflineSale.findOne({
      where: {
        id: saleId,
        ShopId: req.shopId,
      },
      attributes: ["id", "totalAmount", "status", "createdAt", "note"],
      include: [
        {
          model: User,
          attributes: ["id", "name"],
        },
        {
          model: OfflineSaleItem,
          attributes: ["id", "ProductId", "quantity", "priceAtSale"],
          include: [
            {
              model: Product,
              attributes: ["id", "name", "imageUrl"],
              required: false,
            },
            {
              model: OfflineSaleItemLotAllocation,
              attributes: ["id", "quantity", "unitCostMinorAtAllocation", "metadata"],
              include: [
                {
                  model: InventoryLot,
                  attributes: ["id", "lotCode", "sourceType"],
                  required: false,
                },
              ],
              required: false,
            },
          ],
        },
      ],
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found." });
    }

    const items = (sale.OfflineSaleItems || []).map((item) => {
      const lineTotalMinor = Number(item.priceAtSale || 0) * Number(item.quantity || 0);
      return {
        id: item.id,
        productId: item.ProductId,
        productName: item.Product?.name || "Product",
        productImage: item.Product?.imageUrl || null,
        quantity: Number(item.quantity || 0),
        priceAtSaleMinor: Number(item.priceAtSale || 0),
        priceAtSale: minorToMajor(item.priceAtSale),
        lineTotalMinor,
        lineTotal: minorToMajor(lineTotalMinor),
        lotAllocations: (item.OfflineSaleItemLotAllocations || []).map((allocation) => ({
          id: allocation.id,
          quantity: Number(allocation.quantity || 0),
          unitCostMinorAtAllocation:
            allocation.unitCostMinorAtAllocation == null
              ? null
              : Number(allocation.unitCostMinorAtAllocation),
          lot: allocation.InventoryLot
            ? {
                id: allocation.InventoryLot.id,
                lotCode: allocation.InventoryLot.lotCode,
                sourceType: allocation.InventoryLot.sourceType,
              }
            : null,
        })),
      };
    });

    return res.json({
      sale: {
        id: sale.id,
        totalAmountMinor: sale.totalAmount,
        totalAmount: minorToMajor(sale.totalAmount),
        status: sale.status,
        note: sale.note || null,
        createdAt: sale.createdAt,
        cashier: sale.User
          ? {
              id: sale.User.id,
              name: sale.User.name,
            }
          : null,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      },
      items,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listProducts,
  searchProducts,
  createSale,
  listRecentSales,
  getRecentSaleDetails,
};
