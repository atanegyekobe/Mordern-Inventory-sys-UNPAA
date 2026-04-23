const {
  User,
  Product,
  Category,
  OfflineSale,
  OfflineSaleItem,
  InventoryMovement,
  InventoryLot,
} = require("../models");
const { Op } = require("sequelize");
const { ensureMinorInt, majorToMinor, minorToMajor } = require("../utils/money");

const LOW_STOCK_THRESHOLD = 5;

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveDateRange = ({ period, startDate, endDate }) => {
  const now = new Date();
  const today = startOfDay(now);

  if (period === "day") {
    return { period: "day", start: today, end: now };
  }

  if (period === "week") {
    const start = startOfDay(new Date(today));
    start.setDate(start.getDate() - 6);
    return { period: "week", start, end: now };
  }

  if (period === "year") {
    return {
      period: "year",
      start: new Date(now.getFullYear(), 0, 1),
      end: now,
    };
  }

  if (period === "custom") {
    const parsedStart = parseDateInput(startDate);
    const parsedEnd = parseDateInput(endDate);
    if (!parsedStart || !parsedEnd) {
      return null;
    }
    const start = startOfDay(parsedStart);
    const end = new Date(parsedEnd);
    end.setHours(23, 59, 59, 999);
    if (start > end) {
      return null;
    }
    return { period: "custom", start, end };
  }

  return {
    period: "month",
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: now,
  };
};

const toPctDelta = (current, previous) => {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

const toDayKey = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
};

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
    const range = resolveDateRange({
      period: String(req.query.period || "month"),
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    if (!range) {
      return res.status(400).json({ message: "Invalid analytics date range." });
    }

    const categoryId = String(req.query.categoryId || "").trim() || null;
    const productId = String(req.query.productId || "").trim() || null;
    const stockThresholdRaw = String(req.query.stockThreshold || "").trim();
    const stockThreshold = stockThresholdRaw === "" ? null : Number(stockThresholdRaw);

    const previousEnd = new Date(range.start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - (range.end.getTime() - range.start.getTime()));

    const saleInclude = [
      {
        model: OfflineSaleItem,
        include: [
          {
            model: Product,
            attributes: ["id", "name", "stock", "CategoryId", "cost", "costMinor", "price", "priceMinor", "status"],
            include: [{ model: Category, attributes: ["id", "name"], required: false }],
            required: false,
          },
        ],
        required: false,
      },
    ];

    const [
      categories,
      products,
      currentSales,
      previousSales,
      customers,
      newCustomers,
      lowStockProducts,
    ] = await Promise.all([
      Category.findAll({
        where: { ShopId: req.shopId },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      Product.findAll({
        where: { ShopId: req.shopId },
        attributes: ["id", "name", "CategoryId", "stock", "imageUrl", "price", "status"],
        include: [{ model: Category, attributes: ["id", "name"], required: false }],
        order: [["name", "ASC"]],
      }),
      OfflineSale.findAll({
        where: {
          ShopId: req.shopId,
          status: "COMPLETED",
          createdAt: { [Op.between]: [range.start, range.end] },
        },
        include: saleInclude,
        order: [["createdAt", "ASC"]],
      }),
      OfflineSale.findAll({
        where: {
          ShopId: req.shopId,
          status: "COMPLETED",
          createdAt: { [Op.between]: [previousStart, previousEnd] },
        },
        include: saleInclude,
      }),
      User.count({ where: { role: "customer" } }),
      User.count({ where: { role: "customer", createdAt: { [Op.between]: [range.start, range.end] } } }),
      Product.findAll({
        where: {
          ShopId: req.shopId,
          stock: { [Op.lte]: LOW_STOCK_THRESHOLD },
          status: "active",
        },
        include: [{ model: Category, attributes: ["id", "name"], required: false }],
        order: [["stock", "ASC"]],
      }),
    ]);

    const hasProductFilter = Boolean(productId);
    const hasCategoryFilter = Boolean(categoryId);
    const hasStockFilter = Number.isFinite(stockThreshold);
    const hasActiveFilters = hasProductFilter || hasCategoryFilter || hasStockFilter;

    const matchesProductFilters = (product) => {
      if (!product) return false;
      if (hasProductFilter && String(product.id) !== productId) {
        return false;
      }
      if (hasCategoryFilter && String(product.CategoryId) !== categoryId) {
        return false;
      }
      if (hasStockFilter && Number(product.stock || 0) > Number(stockThreshold)) {
        return false;
      }
      return true;
    };

    const buildSaleMetrics = (sales, useFilters) => {
      let revenueMinor = 0;
      let profitMinor = 0;
      let unitsSold = 0;
      let lineItemsCount = 0;
      let salesCount = 0;
      const activeCustomerIds = new Set();
      const dailyMap = new Map();
      const productMap = new Map();
      const categoryMap = new Map();

      for (const sale of sales) {
        const saleItems = (sale.OfflineSaleItems || []).filter((item) => {
          if (!useFilters) return true;
          return matchesProductFilters(item.Product);
        });

        if (useFilters && saleItems.length === 0) {
          continue;
        }

        const effectiveRevenueMinor = useFilters
          ? saleItems.reduce((sum, item) => sum + ensureMinorInt(item.priceAtSale) * ensureMinorInt(item.quantity), 0)
          : ensureMinorInt(sale.totalAmount);

        const dayKey = toDayKey(sale.createdAt);
        const dayRow = dailyMap.get(dayKey) || { date: dayKey, salesCount: 0, revenueMinor: 0, profitMinor: 0 };
        dayRow.salesCount += 1;
        dayRow.revenueMinor += effectiveRevenueMinor;

        let saleProfitMinor = 0;

        for (const item of saleItems) {
          const product = item.Product;
          const quantity = ensureMinorInt(item.quantity);
          const unitPriceMinor = ensureMinorInt(item.priceAtSale);
          const unitCostMinor = ensureMinorInt(
            product?.costMinor != null ? product.costMinor : majorToMinor(product?.cost || 0)
          );

          const lineRevenueMinor = unitPriceMinor * quantity;
          const lineCostMinor = unitCostMinor * quantity;
          const lineProfitMinor = lineRevenueMinor - lineCostMinor;

          unitsSold += quantity;
          lineItemsCount += 1;
          saleProfitMinor += lineProfitMinor;

          if (product) {
            const productRow = productMap.get(product.id) || {
              ProductId: product.id,
              totalSold: 0,
              totalRevenueMinor: 0,
              Product: {
                id: product.id,
                name: product.name,
                imageUrl: product.imageUrl || null,
              },
            };
            productRow.totalSold += quantity;
            productRow.totalRevenueMinor += lineRevenueMinor;
            productMap.set(product.id, productRow);

            const categoryKey = product.Category?.id || "uncategorized";
            const categoryRow = categoryMap.get(categoryKey) || {
              totalSold: 0,
              totalRevenueMinor: 0,
              Product: {
                Category: {
                  id: product.Category?.id || "uncategorized",
                  name: product.Category?.name || "Uncategorized",
                },
              },
            };
            categoryRow.totalSold += quantity;
            categoryRow.totalRevenueMinor += lineRevenueMinor;
            categoryMap.set(categoryKey, categoryRow);
          }
        }

        dayRow.profitMinor += saleProfitMinor;
        dailyMap.set(dayKey, dayRow);

        revenueMinor += effectiveRevenueMinor;
        profitMinor += saleProfitMinor;
        salesCount += 1;
        activeCustomerIds.add(String(sale.UserId));
      }

      const topSellingProducts = Array.from(productMap.values())
        .sort((a, b) => b.totalSold - a.totalSold)
        .map((row) => ({
          ...row,
          totalRevenue: minorToMajor(row.totalRevenueMinor),
        }));

      const categoryPerformance = Array.from(categoryMap.values())
        .sort((a, b) => b.totalRevenueMinor - a.totalRevenueMinor)
        .map((row) => ({
          ...row,
          totalRevenue: minorToMajor(row.totalRevenueMinor),
        }));

      const dailyBreakdown = Array.from(dailyMap.values()).map((row) => ({
        date: row.date,
        salesCount: row.salesCount,
        revenue: minorToMajor(row.revenueMinor),
        profit: minorToMajor(row.profitMinor),
      }));

      return {
        revenueMinor,
        profitMinor,
        unitsSold,
        lineItemsCount,
        salesCount,
        activeCustomers: activeCustomerIds.size,
        topSellingProducts,
        categoryPerformance,
        dailyBreakdown,
      };
    };

    const currentMetrics = buildSaleMetrics(currentSales, false);
    const previousMetrics = buildSaleMetrics(previousSales, false);
    const filteredMetrics = buildSaleMetrics(currentSales, hasActiveFilters);

    const revenueDelta = currentMetrics.revenueMinor - previousMetrics.revenueMinor;
    const ordersDelta = currentMetrics.salesCount - previousMetrics.salesCount;
    const profitDelta = currentMetrics.profitMinor - previousMetrics.profitMinor;
    const customersDelta = currentMetrics.activeCustomers - previousMetrics.activeCustomers;

    const lowStock = lowStockProducts
      .filter((product) => product.stock > 0)
      .map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        price: Number(product.price || 0),
        imageUrl: product.imageUrl,
        Category: product.Category ? { id: product.Category.id, name: product.Category.name } : null,
      }));

    const critical = lowStockProducts
      .filter((product) => product.stock <= 0)
      .map((product) => ({ id: product.id, name: product.name, stock: product.stock }));

    return res.json({
      period: range.period,
      dateRange: {
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
      overview: {
        revenue: minorToMajor(currentMetrics.revenueMinor),
        orders: currentMetrics.salesCount,
        pendingOrders: 0,
        customers,
        newCustomers,
        activeCustomers: currentMetrics.activeCustomers,
        offlineSales: currentMetrics.salesCount,
      },
      trends: {
        revenueChange: toPctDelta(currentMetrics.revenueMinor, previousMetrics.revenueMinor),
        ordersChange: toPctDelta(currentMetrics.salesCount, previousMetrics.salesCount),
        customersChange: toPctDelta(currentMetrics.activeCustomers, previousMetrics.activeCustomers),
      },
      kpiTrends: {
        periodRevenue: {
          current: minorToMajor(currentMetrics.revenueMinor),
          previous: minorToMajor(previousMetrics.revenueMinor),
          delta: minorToMajor(revenueDelta),
          deltaPct: toPctDelta(currentMetrics.revenueMinor, previousMetrics.revenueMinor),
        },
        periodOrders: {
          current: currentMetrics.salesCount,
          previous: previousMetrics.salesCount,
          delta: ordersDelta,
          deltaPct: toPctDelta(currentMetrics.salesCount, previousMetrics.salesCount),
        },
        periodProfit: {
          current: minorToMajor(currentMetrics.profitMinor),
          previous: minorToMajor(previousMetrics.profitMinor),
          delta: minorToMajor(profitDelta),
          deltaPct: toPctDelta(currentMetrics.profitMinor, previousMetrics.profitMinor),
        },
      },
      topSellingProducts: filteredMetrics.topSellingProducts,
      categoryPerformance: filteredMetrics.categoryPerformance,
      dailyBreakdown: filteredMetrics.dailyBreakdown,
      filteredMetrics: {
        salesCount: filteredMetrics.salesCount,
        revenue: minorToMajor(filteredMetrics.revenueMinor),
        profit: minorToMajor(filteredMetrics.profitMinor),
      },
      stockInsights: {
        lowStockCount: products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
        outOfStockCount: products.filter((p) => p.stock <= 0).length,
      },
      products: {
        lowStock,
        critical,
      },
      filters: {
        applied: {
          categoryId,
          productId,
          stockThreshold,
        },
        options: {
          categories,
          products,
        },
        categories,
        products,
      },
      generatedAt: new Date().toISOString(),
      deltas: {
        revenue: minorToMajor(revenueDelta),
        orders: ordersDelta,
        customers: customersDelta,
        profit: minorToMajor(profitDelta),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const salesManagement = async (req, res, next) => {
  try {
    const range = resolveDateRange({
      period: String(req.query.period || "month"),
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    if (!range) {
      return res.status(400).json({ message: "Invalid sales-management date range." });
    }

    const currentPage = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.limit || req.query.pageSize) || 25));

    const categoryId = String(req.query.categoryId || "").trim() || null;
    const productId = String(req.query.productId || "").trim() || null;
    const orderId = String(req.query.orderId || "").trim() || null;

    const [sales, categories, products] = await Promise.all([
      OfflineSale.findAll({
        where: {
          ShopId: req.shopId,
          status: "COMPLETED",
          createdAt: { [Op.between]: [range.start, range.end] },
        },
        include: [
          {
            model: OfflineSaleItem,
            required: false,
            include: [
              {
                model: Product,
                required: false,
                attributes: ["id", "name", "stock", "cost", "costMinor", "CategoryId"],
                include: [{ model: Category, attributes: ["id", "name"], required: false }],
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      }),
      Category.findAll({
        where: { ShopId: req.shopId },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      Product.findAll({
        where: { ShopId: req.shopId },
        attributes: ["id", "name", "CategoryId", "stock"],
        order: [["name", "ASC"]],
      }),
    ]);

    const lineRows = [];

    for (const sale of sales) {
      const items = sale.OfflineSaleItems || [];
      for (const item of items) {
        const product = item.Product;
        if (!product) {
          continue;
        }

        if (orderId && String(sale.id) !== orderId) {
          continue;
        }
        if (productId && String(product.id) !== productId) {
          continue;
        }
        if (categoryId && String(product.CategoryId) !== categoryId) {
          continue;
        }

        const quantity = ensureMinorInt(item.quantity);
        const unitPriceMinor = ensureMinorInt(item.priceAtSale);
        const unitCostMinor = ensureMinorInt(
          product.costMinor != null ? product.costMinor : majorToMinor(product.cost || 0)
        );

        const revenueMinor = unitPriceMinor * quantity;
        const costMinor = unitCostMinor * quantity;
        const profitMinor = revenueMinor - costMinor;
        const marginPct = revenueMinor > 0 ? (profitMinor / revenueMinor) * 100 : 0;

        lineRows.push({
          id: item.id,
          createdAt: sale.createdAt,
          quantity,
          unitPrice: minorToMajor(unitPriceMinor),
          revenue: minorToMajor(revenueMinor),
          costTotal: minorToMajor(costMinor),
          profit: minorToMajor(profitMinor),
          marginPct,
          order: {
            id: sale.id,
            status: sale.status,
            currency: "USD",
            total: minorToMajor(ensureMinorInt(sale.totalAmount)),
            createdAt: sale.createdAt,
          },
          product: {
            id: product.id,
            name: product.name,
            stock: ensureMinorInt(product.stock),
            cost: minorToMajor(unitCostMinor),
            categoryName: product.Category?.name || "Uncategorized",
          },
        });
      }
    }

    const orderIds = new Set(lineRows.map((row) => row.order.id));
    const ordersCount = orderIds.size;
    const lineItemsCount = lineRows.length;
    const unitsSold = lineRows.reduce((sum, row) => sum + row.quantity, 0);
    const revenue = lineRows.reduce((sum, row) => sum + row.revenue, 0);
    const cost = lineRows.reduce((sum, row) => sum + row.costTotal, 0);
    const profit = revenue - cost;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    const byProduct = new Map();
    for (const row of lineRows) {
      const key = row.product.id;
      const existing = byProduct.get(key) || {
        productId: row.product.id,
        productName: row.product.name,
        categoryName: row.product.categoryName,
        stockRemaining: row.product.stock,
        orderIds: new Set(),
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };

      existing.orderIds.add(row.order.id);
      existing.unitsSold += row.quantity;
      existing.revenue += row.revenue;
      existing.cost += row.costTotal;
      existing.profit += row.profit;
      byProduct.set(key, existing);
    }

    const stockBreakdown = Array.from(byProduct.values())
      .map((row) => ({
        productId: row.productId,
        productName: row.productName,
        categoryName: row.categoryName,
        stockRemaining: row.stockRemaining,
        ordersCount: row.orderIds.size,
        unitsSold: row.unitsSold,
        revenue: row.revenue,
        cost: row.cost,
        profit: row.profit,
        marginPct: row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);

    const totalItems = lineRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / size));
    const safePage = Math.min(currentPage, totalPages);
    const offset = (safePage - 1) * size;
    const paginatedItems = lineRows.slice(offset, offset + size);

    return res.json({
      period: range.period,
      dateRange: {
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      },
      summary: {
        ordersCount,
        lineItemsCount,
        unitsSold,
        revenue,
        cost,
        profit,
        marginPct,
      },
      orderProfitability: {
        page: safePage,
        limit: size,
        totalItems,
        totalPages,
        items: paginatedItems,
      },
      stockBreakdown,
      filters: {
        applied: {
          categoryId,
          productId,
          orderId,
        },
        options: {
          categories,
          products,
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

const listStockMovements = async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const movementType = String(req.query.movementType || "").trim().toUpperCase();
    const productId = String(req.query.productId || "").trim();

    const where = { ShopId: req.shopId };

    if (movementType && ["IN", "OUT", "ADJUSTMENT"].includes(movementType)) {
      where.movementType = movementType;
    }

    if (productId) {
      where.ProductId = productId;
    }

    const movements = await InventoryMovement.findAll({
      where,
      include: [
        {
          model: Product,
          attributes: ["id", "name", "sku"],
          required: false,
        },
        {
          model: User,
          as: "CreatedBy",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });

    return res.json({
      movements: movements.map((movement) => ({
        id: movement.id,
        movementType: movement.movementType,
        changeQty: movement.changeQty,
        quantityAfter: movement.quantityAfter,
        reason: movement.reason,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        note: movement.note,
        createdAt: movement.createdAt,
        metadata: movement.metadata || {},
        product: movement.Product
          ? {
              id: movement.Product.id,
              name: movement.Product.name,
              sku: movement.Product.sku || null,
            }
          : null,
        createdBy: movement.CreatedBy
          ? {
              id: movement.CreatedBy.id,
              name: movement.CreatedBy.name,
              email: movement.CreatedBy.email,
            }
          : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const listStockLots = async (req, res, next) => {
  try {
    const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 120));
    const status = String(req.query.status || "").trim().toLowerCase();
    const productId = String(req.query.productId || "").trim();

    const where = { ShopId: req.shopId };

    if (["open", "consumed", "void"].includes(status)) {
      where.status = status;
    }

    if (productId) {
      where.ProductId = productId;
    }

    const lots = await InventoryLot.findAll({
      where,
      include: [
        {
          model: Product,
          attributes: ["id", "name", "sku"],
          required: false,
        },
        {
          model: User,
          as: "CreatedBy",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["receivedAt", "ASC"], ["createdAt", "ASC"]],
      limit,
    });

    return res.json({
      lots: lots.map((lot) => ({
        id: lot.id,
        lotCode: lot.lotCode,
        sourceType: lot.sourceType,
        sourceRefId: lot.sourceRefId,
        initialQty: lot.initialQty,
        remainingQty: lot.remainingQty,
        unitCostMinor: lot.unitCostMinor,
        status: lot.status,
        receivedAt: lot.receivedAt,
        expiresAt: lot.expiresAt,
        note: lot.note,
        metadata: lot.metadata || {},
        product: lot.Product
          ? {
              id: lot.Product.id,
              name: lot.Product.name,
              sku: lot.Product.sku || null,
            }
          : null,
        createdBy: lot.CreatedBy
          ? {
              id: lot.CreatedBy.id,
              name: lot.CreatedBy.name,
              email: lot.CreatedBy.email,
            }
          : null,
      })),
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
  listStockMovements,
  listStockLots,
};
