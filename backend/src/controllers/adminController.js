// Reconciliation report endpoint
const path = require("path");
const fs = require("fs");
const { LOG_PATH } = require("../scripts/reconciliationJob");

const reconciliationReport = async (req, res, next) => {
  try {
    if (!fs.existsSync(LOG_PATH)) {
      return res.status(404).json({ message: "No reconciliation report found." });
    }
    const data = fs.readFileSync(LOG_PATH, "utf-8");
    const report = JSON.parse(data);
    return res.json(report);
  } catch (error) {
    return next(error);
  }
};
const { User, Product, Order, OrderItem, Category, Message, Coupon } = require("../models");
const { Op, sequelize } = require("sequelize");
const { ensureMinorInt, majorToMinor, minorToMajor } = require("../utils/money");

// Low stock threshold - products with stock below this will trigger alerts
const LOW_STOCK_THRESHOLD = 5;
const CRITICAL_STOCK_THRESHOLD = 0; // For critical/out of stock alerts

const summary = async (req, res, next) => {
  try {
    const [users, products, orders] = await Promise.all([
      Order.count({ where: { ShopId: req.shopId }, distinct: true, col: "UserId" }),
      Product.count({ where: { ShopId: req.shopId } }),
      Order.count({ where: { ShopId: req.shopId } }),
    ]);

    return res.json({ users, products, orders });
  } catch (error) {
    return next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const {
      period = "month",
      startDate: customStartDate,
      endDate: customEndDate,
      categoryId,
      productId,
      stockThreshold,
    } = req.query;

    const now = new Date();
    let startDate;
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
      case "day":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "year":
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "custom": {
        if (!customStartDate || !customEndDate) {
          return res.status(400).json({
            message: "Custom period requires startDate and endDate",
          });
        }

        const parsedStartDate = new Date(String(customStartDate));
        const parsedEndDate = new Date(String(customEndDate));
        if (
          Number.isNaN(parsedStartDate.getTime()) ||
          Number.isNaN(parsedEndDate.getTime())
        ) {
          return res.status(400).json({ message: "Invalid custom date range" });
        }

        parsedStartDate.setHours(0, 0, 0, 0);
        parsedEndDate.setHours(23, 59, 59, 999);
        if (parsedStartDate > parsedEndDate) {
          return res.status(400).json({
            message: "startDate must be before or equal to endDate",
          });
        }

        startDate = parsedStartDate;
        endDate = parsedEndDate;
        break;
      }
      case "month":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const currentRangeMs = Math.max(1, endDate.getTime() - startDate.getTime() + 1);
    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate.getTime() - currentRangeMs + 1);

    const productWhere = { ShopId: req.shopId };
    if (categoryId) productWhere.CategoryId = categoryId;
    if (productId) productWhere.id = productId;

    const currentOrderItemWhere = {
      ShopId: req.shopId,
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    };

    const previousOrderItemWhere = {
      ShopId: req.shopId,
      createdAt: {
        [Op.gte]: previousStartDate,
        [Op.lte]: previousEndDate,
      },
    };

    const productIncludeForItems = {
      model: Product,
      attributes: ["id", "name", "imageUrl", "CategoryId", "stock", "status", "costMinor", "cost"],
      where: productWhere,
      required: true,
      include: [
        {
          model: Category,
          attributes: ["id", "name"],
          required: false,
        },
      ],
    };

    const [
      totalRevenueMinor,
      totalOrders,
      pendingOrders,
      totalCustomers,
      currentOrderItems,
      previousOrderItems,
      categories,
      products,
    ] = await Promise.all([
      Order.sum("totalMinor", { where: { ShopId: req.shopId } }),
      Order.count({ where: { ShopId: req.shopId } }),
      Order.count({ where: { ShopId: req.shopId, status: { [Op.in]: ["pending_payment", "pending"] } } }),
      Order.count({ where: { ShopId: req.shopId }, distinct: true, col: "UserId" }),
      OrderItem.findAll({
        where: currentOrderItemWhere,
        include: [productIncludeForItems],
        order: [["createdAt", "DESC"]],
      }),
      OrderItem.findAll({
        where: previousOrderItemWhere,
        include: [productIncludeForItems],
        order: [["createdAt", "DESC"]],
      }),
      Category.findAll({
        where: { ShopId: req.shopId },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      Product.findAll({
        where: { ShopId: req.shopId },
        attributes: ["id", "name", "CategoryId", "stock", "imageUrl", "price", "status"],
        order: [["name", "ASC"]],
      }),
    ]);

    const newCustomers = await User.count({
      where: {
        role: "customer",
        createdAt: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
      },
      include: [
        {
          model: Order,
          where: { ShopId: req.shopId },
          required: true,
          attributes: [],
        },
      ],
      distinct: true,
      col: "User.id",
    });

    const activeCustomers = await User.count({
      where: { role: "customer" },
      include: [
        {
          model: Order,
          where: {
            ShopId: req.shopId,
            createdAt: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
          },
          required: true,
          attributes: [],
        },
      ],
      distinct: true,
      col: "User.id",
    });

    const toMinorFromItem = (item) =>
      ensureMinorInt(item.priceAtPurchase || item.unitPriceMinor || majorToMinor(item.unitPrice || 0));

    const toCostMinorFromItem = (item) =>
      ensureMinorInt(item.costAtPurchase || item.Product?.costMinor || majorToMinor(item.Product?.cost || 0));

    const summarizeItems = (items) => {
      let revenueMinor = 0;
      let profitMinor = 0;
      let quantity = 0;
      const orderIds = new Set();

      for (const item of items) {
        const qty = Number(item.quantity || 0);
        const unitMinor = toMinorFromItem(item);
        const costMinor = toCostMinorFromItem(item);
        const lineRevenueMinor = qty * unitMinor;
        const lineProfitMinor = lineRevenueMinor - qty * costMinor;

        revenueMinor += lineRevenueMinor;
        profitMinor += lineProfitMinor;
        quantity += qty;
        if (item.OrderId) {
          orderIds.add(item.OrderId);
        }
      }

      return {
        revenueMinor,
        profitMinor,
        quantity,
        orderCount: orderIds.size,
      };
    };

    const currentSummary = summarizeItems(currentOrderItems);
    const previousSummary = summarizeItems(previousOrderItems);

    const topSellingMap = new Map();
    const categoryMap = new Map();
    const breakdownMap = new Map();

    for (const item of currentOrderItems) {
      const qty = Number(item.quantity || 0);
      const unitMinor = toMinorFromItem(item);
      const lineRevenueMinor = qty * unitMinor;
      const itemDate = new Date(item.createdAt);
      const dayKey = itemDate.toISOString().slice(0, 10);
      const costMinor = toCostMinorFromItem(item);
      const lineProfitMinor = lineRevenueMinor - qty * costMinor;

      const product = item.Product;
      if (product) {
        if (!topSellingMap.has(product.id)) {
          topSellingMap.set(product.id, {
            ProductId: product.id,
            totalSold: 0,
            totalRevenueMinor: 0,
            Product: {
              id: product.id,
              name: product.name,
              imageUrl: product.imageUrl,
            },
          });
        }

        const topEntry = topSellingMap.get(product.id);
        topEntry.totalSold += qty;
        topEntry.totalRevenueMinor += lineRevenueMinor;

        const categoryIdValue = product.Category?.id || product.CategoryId || "uncategorized";
        const categoryNameValue = product.Category?.name || "Uncategorized";

        if (!categoryMap.has(categoryIdValue)) {
          categoryMap.set(categoryIdValue, {
            totalSold: 0,
            totalRevenueMinor: 0,
            Product: {
              Category: {
                id: categoryIdValue,
                name: categoryNameValue,
              },
            },
          });
        }

        const categoryEntry = categoryMap.get(categoryIdValue);
        categoryEntry.totalSold += qty;
        categoryEntry.totalRevenueMinor += lineRevenueMinor;
      }

      if (!breakdownMap.has(dayKey)) {
        breakdownMap.set(dayKey, {
          date: dayKey,
          salesCount: 0,
          revenueMinor: 0,
          profitMinor: 0,
        });
      }

      const dayEntry = breakdownMap.get(dayKey);
      dayEntry.salesCount += qty;
      dayEntry.revenueMinor += lineRevenueMinor;
      dayEntry.profitMinor += lineProfitMinor;
    }

    const topSelling = Array.from(topSellingMap.values())
      .map((item) => ({
        ProductId: item.ProductId,
        totalSold: item.totalSold,
        totalRevenue: minorToMajor(item.totalRevenueMinor),
        Product: item.Product,
      }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 20);

    const categoryPerformance = Array.from(categoryMap.values())
      .map((item) => ({
        totalSold: item.totalSold,
        totalRevenue: minorToMajor(item.totalRevenueMinor),
        Product: item.Product,
      }))
      .sort((a, b) => b.totalSold - a.totalSold);

    const threshold = Number.isFinite(Number(stockThreshold))
      ? Number.parseInt(String(stockThreshold), 10)
      : LOW_STOCK_THRESHOLD;

    const lowStock = products
      .filter((product) => product.status === "active" && product.stock <= threshold)
      .map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        price: product.price,
        imageUrl: product.imageUrl,
        Category:
          categories.find((category) => category.id === product.CategoryId) ||
          { id: "uncategorized", name: "Uncategorized" },
      }))
      .sort((a, b) => a.stock - b.stock);

    const critical = lowStock
      .filter((product) => product.stock <= CRITICAL_STOCK_THRESHOLD)
      .map((product) => ({ id: product.id, name: product.name, stock: product.stock }));

    const dailyBreakdown = Array.from(breakdownMap.values())
      .map((day) => ({
        date: day.date,
        salesCount: day.salesCount,
        revenue: minorToMajor(day.revenueMinor),
        profit: minorToMajor(day.profitMinor),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const makeTrend = (currentValue, previousValue) => {
      const delta = currentValue - previousValue;
      const deltaPct = previousValue === 0 ? (currentValue > 0 ? 100 : 0) : (delta / previousValue) * 100;
      return {
        current: currentValue,
        previous: previousValue,
        delta,
        deltaPct,
      };
    };

    return res.json({
      revenue: {
        total: minorToMajor(ensureMinorInt(totalRevenueMinor || 0)),
        period: minorToMajor(currentSummary.revenueMinor),
        avgOrderValue:
          currentSummary.orderCount > 0
            ? minorToMajor(Math.round(currentSummary.revenueMinor / currentSummary.orderCount))
            : 0,
      },
      orders: {
        total: totalOrders,
        period: currentSummary.orderCount,
        pending: pendingOrders,
      },
      customers: {
        total: totalCustomers,
        new: newCustomers,
        active: activeCustomers,
      },
      products: {
        topSelling,
        categoryPerformance,
        lowStock,
        critical,
      },
      dailyBreakdown,
      filteredMetrics: {
        salesCount: currentSummary.quantity,
        revenue: minorToMajor(currentSummary.revenueMinor),
        profit: minorToMajor(currentSummary.profitMinor),
      },
      filters: {
        applied: {
          categoryId: categoryId || null,
          productId: productId || null,
          stockThreshold: Number.isFinite(Number(stockThreshold))
            ? Number.parseInt(String(stockThreshold), 10)
            : null,
        },
        options: {
          categories,
          products,
        },
      },
      kpiTrends: {
        periodRevenue: makeTrend(
          minorToMajor(currentSummary.revenueMinor),
          minorToMajor(previousSummary.revenueMinor)
        ),
        periodOrders: makeTrend(currentSummary.orderCount, previousSummary.orderCount),
        periodProfit: makeTrend(
          minorToMajor(currentSummary.profitMinor),
          minorToMajor(previousSummary.profitMinor)
        ),
      },
      generatedAt: new Date().toISOString(),
      period,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return next(error);
  }
};

const salesManagement = async (req, res, next) => {
  try {
    const {
      period = "month",
      startDate: customStartDate,
      endDate: customEndDate,
      categoryId,
      productId,
      orderId,
      page = "1",
      limit = "25",
    } = req.query;

    const now = new Date();
    let startDate;
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
      case "day":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "year":
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "custom": {
        if (!customStartDate || !customEndDate) {
          return res.status(400).json({
            message: "Custom period requires startDate and endDate",
          });
        }

        const parsedStartDate = new Date(String(customStartDate));
        const parsedEndDate = new Date(String(customEndDate));
        if (
          Number.isNaN(parsedStartDate.getTime()) ||
          Number.isNaN(parsedEndDate.getTime())
        ) {
          return res.status(400).json({
            message: "Invalid custom date range",
          });
        }

        parsedStartDate.setHours(0, 0, 0, 0);
        parsedEndDate.setHours(23, 59, 59, 999);
        if (parsedStartDate > parsedEndDate) {
          return res.status(400).json({
            message: "startDate must be before or equal to endDate",
          });
        }

        startDate = parsedStartDate;
        endDate = parsedEndDate;
        break;
      }
      case "month":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const safePage = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(String(limit), 10) || 25));
    const offset = (safePage - 1) * safeLimit;

    const orderItemWhere = {
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    };
    if (orderId) {
      orderItemWhere.OrderId = orderId;
    }

    const productWhere = { ShopId: req.shopId };
    if (categoryId) productWhere.CategoryId = categoryId;
    if (productId) productWhere.id = productId;

    const includeDefinition = [
      {
        model: Order,
        attributes: ["id", "status", "currency", "createdAt", "total", "totalMinor"],
        where: { ShopId: req.shopId },
      },
      {
        model: Product,
        attributes: ["id", "name", "stock", "cost", "costMinor", "CategoryId"],
        ...(Object.keys(productWhere).length > 0
          ? { where: productWhere, required: true }
          : {}),
        include: [
          {
            model: Category,
            attributes: ["id", "name"],
          },
        ],
      },
    ];

    const [pagedResult, allResult, categories, products] = await Promise.all([
      OrderItem.findAndCountAll({
        attributes: [
          "id",
          "OrderId",
          "ProductId",
          "quantity",
          "unitPrice",
          "unitPriceMinor",
          "priceAtPurchase",
          "costAtPurchase",
          "createdAt",
        ],
        where: orderItemWhere,
        include: includeDefinition,
        order: [["createdAt", "DESC"]],
        limit: safeLimit,
        offset,
      }),
      OrderItem.findAll({
        attributes: [
          "id",
          "OrderId",
          "ProductId",
          "quantity",
          "unitPrice",
          "unitPriceMinor",
          "priceAtPurchase",
          "costAtPurchase",
          "createdAt",
        ],
        where: orderItemWhere,
        include: includeDefinition,
        order: [["createdAt", "DESC"]],
      }),
      Category.findAll({
        attributes: ["id", "name"],
        where: { ShopId: req.shopId },
        order: [["name", "ASC"]],
      }),
      Product.findAll({
        attributes: ["id", "name", "CategoryId", "stock"],
        where: productWhere,
        order: [["name", "ASC"]],
      }),
    ]);

    const mapSalesRow = (item) => {
      const quantity = Number(item.quantity || 0);
      const unitPriceMinor = ensureMinorInt(
        item.priceAtPurchase || item.unitPriceMinor || majorToMinor(item.unitPrice || 0)
      );
      const costMinor = ensureMinorInt(
        item.costAtPurchase || item.Product?.costMinor || majorToMinor(item.Product?.cost || 0)
      );
      const revenueMinor = quantity * unitPriceMinor;
      const costTotalMinor = quantity * costMinor;
      const profitMinor = revenueMinor - costTotalMinor;
      const marginPct = revenueMinor === 0 ? 0 : (profitMinor / revenueMinor) * 100;

      return {
        id: item.id,
        createdAt: item.createdAt,
        quantity,
        unitPrice: minorToMajor(unitPriceMinor),
        revenue: minorToMajor(revenueMinor),
        costTotal: minorToMajor(costTotalMinor),
        profit: minorToMajor(profitMinor),
        marginPct,
        order: {
          id: item.Order?.id,
          status: item.Order?.status,
          currency: item.Order?.currency,
          total: minorToMajor(
            ensureMinorInt(item.Order?.totalMinor || majorToMinor(item.Order?.total || 0))
          ),
          createdAt: item.Order?.createdAt,
        },
        product: {
          id: item.Product?.id,
          name: item.Product?.name,
          stock: item.Product?.stock,
          cost: minorToMajor(costMinor),
          categoryId: item.Product?.Category?.id || item.Product?.CategoryId,
          categoryName: item.Product?.Category?.name || "Uncategorized",
        },
      };
    };

    const paginatedRows = pagedResult.rows.map(mapSalesRow);
    const allRows = allResult.map(mapSalesRow);

    const uniqueOrderIds = new Set();
    let totalRevenueMinor = 0;
    let totalCostMinor = 0;
    let totalProfitMinor = 0;
    let totalUnits = 0;

    const stockBreakdownMap = new Map();

    for (const row of allRows) {
      totalRevenueMinor += majorToMinor(row.revenue);
      totalCostMinor += majorToMinor(row.costTotal);
      totalProfitMinor += majorToMinor(row.profit);
      totalUnits += row.quantity;
      if (row.order.id) uniqueOrderIds.add(row.order.id);

      if (!stockBreakdownMap.has(row.product.id)) {
        stockBreakdownMap.set(row.product.id, {
          productId: row.product.id,
          productName: row.product.name,
          categoryName: row.product.categoryName,
          stockRemaining: row.product.stock,
          unitsSold: 0,
          revenueMinor: 0,
          costMinor: 0,
          profitMinor: 0,
          orders: new Set(),
        });
      }

      const stockBucket = stockBreakdownMap.get(row.product.id);
      stockBucket.unitsSold += row.quantity;
      stockBucket.revenueMinor += majorToMinor(row.revenue);
      stockBucket.costMinor += majorToMinor(row.costTotal);
      stockBucket.profitMinor += majorToMinor(row.profit);
      if (row.order.id) stockBucket.orders.add(row.order.id);
    }

    const stockBreakdown = Array.from(stockBreakdownMap.values())
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        categoryName: item.categoryName,
        stockRemaining: item.stockRemaining,
        ordersCount: item.orders.size,
        unitsSold: item.unitsSold,
        revenue: minorToMajor(item.revenueMinor),
        cost: minorToMajor(item.costMinor),
        profit: minorToMajor(item.profitMinor),
        marginPct: item.revenueMinor === 0 ? 0 : (item.profitMinor / item.revenueMinor) * 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalPages = Math.max(1, Math.ceil(pagedResult.count / safeLimit));

    return res.json({
      period,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        ordersCount: uniqueOrderIds.size,
        lineItemsCount: allRows.length,
        unitsSold: totalUnits,
        revenue: minorToMajor(totalRevenueMinor),
        cost: minorToMajor(totalCostMinor),
        profit: minorToMajor(totalProfitMinor),
        marginPct: totalRevenueMinor === 0 ? 0 : (totalProfitMinor / totalRevenueMinor) * 100,
      },
      orderProfitability: {
        page: safePage,
        limit: safeLimit,
        totalItems: pagedResult.count,
        totalPages,
        items: paginatedRows,
      },
      stockBreakdown,
      filters: {
        applied: {
          categoryId: categoryId || null,
          productId: productId || null,
          orderId: orderId || null,
        },
        options: {
          categories,
          products,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sales management error:", error);
    return next(error);
  }
};

// Get low stock products for alerts
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

    const criticalStockProducts = lowStockProducts.filter(
      (p) => p.stock === CRITICAL_STOCK_THRESHOLD
    );
    const warningStockProducts = lowStockProducts.filter(
      (p) => p.stock > CRITICAL_STOCK_THRESHOLD && p.stock <= LOW_STOCK_THRESHOLD
    );

    return res.json({
      lowStock: {
        critical: criticalStockProducts,
        warning: warningStockProducts,
        threshold: LOW_STOCK_THRESHOLD,
        count: lowStockProducts.length,
      },
    });
  } catch (error) {
    console.error("Low stock alert error:", error);
    return next(error);
  }
};

module.exports = {
  summary,
  analytics,
  salesManagement,
  getLowStockAlerts,
  reconciliationReport,
};
