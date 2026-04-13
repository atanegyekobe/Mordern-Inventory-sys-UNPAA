const { User, Product, Category, OfflineSale, Message } = require("../models");
const { Op, sequelize } = require("sequelize");
const { ensureMinorInt, minorToMajor } = require("../utils/money");

const LOW_STOCK_THRESHOLD = 5;

const summary = async (req, res, next) => {
  try {
    const [users, products, categories, lowStock, outOfStock, offlineSales] = await Promise.all([
      User.count({ where: { role: "customer" } }),
      Product.count({ where: { ShopId: req.shopId } }),
      Category.count({ where: { ShopId: req.shopId } }),
      Product.count({
        where: {
          ShopId: req.shopId,
          stock: { [Op.gt]: 0, [Op.lte]: LOW_STOCK_THRESHOLD },
          status: "active",
        },
      }),
      Product.count({
        where: {
          ShopId: req.shopId,
          stock: { [Op.lte]: 0 },
          status: "active",
        },
      }),
      OfflineSale.count({ where: { ShopId: req.shopId } }),
    ]);

    return res.json({
      users,
      products,
      categories,
      lowStock,
      outOfStock,
      offlineSales,
      orders: 0,
    });
  } catch (error) {
    return next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [categories, products, activeCustomers, offlineSales, revenueMinor] = await Promise.all([
      Category.findAll({ where: { ShopId: req.shopId }, attributes: ["id", "name"], order: [["name", "ASC"]] }),
      Product.findAll({ where: { ShopId: req.shopId }, attributes: ["id", "name", "CategoryId", "stock", "imageUrl", "price", "status"], order: [["name", "ASC"]] }),
      User.count({ where: { role: "customer" } }),
      OfflineSale.count({ where: { ShopId: req.shopId, createdAt: { [Op.gte]: monthStart } } }),
      OfflineSale.sum("totalMinor", { where: { ShopId: req.shopId, createdAt: { [Op.gte]: monthStart } } }),
    ]);

    return res.json({
      period: "month",
      dateRange: {
        startDate: monthStart.toISOString(),
        endDate: now.toISOString(),
      },
      overview: {
        revenue: minorToMajor(ensureMinorInt(revenueMinor || 0)),
        orders: 0,
        pendingOrders: 0,
        customers: activeCustomers,
        newCustomers: 0,
        activeCustomers,
        offlineSales,
      },
      trends: {
        revenueChange: 0,
        ordersChange: 0,
        customersChange: 0,
      },
      topSellingProducts: [],
      categoryPerformance: [],
      stockInsights: {
        lowStockCount: products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length,
        outOfStockCount: products.filter((p) => p.stock <= 0).length,
      },
      filters: {
        categories,
        products,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const salesManagement = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const currentPage = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (currentPage - 1) * size;

    const [count, rows] = await Promise.all([
      OfflineSale.count({ where: { ShopId: req.shopId } }),
      OfflineSale.findAll({
        where: { ShopId: req.shopId },
        order: [["createdAt", "DESC"]],
        limit: size,
        offset,
      }),
    ]);

    return res.json({
      summary: {
        totalOrders: 0,
        totalRevenue: 0,
      },
      sales: {
        page: currentPage,
        pageSize: size,
        totalItems: count,
        totalPages: Math.max(1, Math.ceil(count / size)),
        items: rows,
      },
      filters: {
        applied: {},
        options: {
          categories: [],
          products: [],
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};

const getLowStockAlerts = async (req, res, next) => {
  try {
    const lowStockProducts = await Product.findAll({
      where: {
        ShopId: req.shopId,
        stock: { [Op.lte]: LOW_STOCK_THRESHOLD },
        status: "active",
      },
      include: [
        {
          model: Category,
          attributes: ["id", "name"],
          where: { ShopId: req.shopId },
          required: false,
        },
      ],
      order: [["stock", "ASC"]],
    });

    return res.json({
      lowStock: {
        critical: lowStockProducts.filter((p) => p.stock <= 0),
        warning: lowStockProducts.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD),
        threshold: LOW_STOCK_THRESHOLD,
        count: lowStockProducts.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  summary,
  analytics,
  salesManagement,
  getLowStockAlerts,
};
