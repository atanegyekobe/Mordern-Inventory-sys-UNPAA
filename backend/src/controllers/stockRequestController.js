const {
  StockRequest,
  Product,
  User,
} = require("../models");

const createStockRequest = async (req, res, next) => {
  try {
    const { productId, quantity, reason } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ message: "productId and quantity are required." });
    }

    if (Number(quantity) < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1." });
    }

    const product = await Product.findOne({
      where: { id: productId, ShopId: req.shopId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const request = await StockRequest.create({
      ShopId: req.shopId,
      ProductId: productId,
      RequesterId: req.user.id,
      UserId: req.user.id,
      quantity: Number(quantity),
      reason: reason?.trim() || null,
      status: "pending",
    });

    return res.status(201).json({
      id: request.id,
      productId: request.ProductId,
      quantity: request.quantity,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};

const listStockRequests = async (req, res, next) => {
  try {
    const { status, productId } = req.query;
    const where = { ShopId: req.shopId };

    if (status) {
      where.status = status;
    }

    if (productId) {
      where.ProductId = productId;
    }

    // Staff only see their own requests; Admin/Owner see all requests in the shop
    if (req.shopRole === "STAFF") {
      where.RequesterId = req.user.id;
    }
    // If OWNER or ADMIN, they see all shop requests (no filtering)

    const requests = await StockRequest.findAll({
      where,
      include: [
        {
          model: Product,
          attributes: ["id", "name", "sku", "stock"],
        },
        {
          model: User,
          as: "Requester",
          attributes: ["id", "name", "email"],
        },
        {
          model: User,
          as: "Approver",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      requests: requests.map((r) => ({
        id: r.id,
        productId: r.ProductId,
        product: r.Product ? {
          id: r.Product.id,
          name: r.Product.name,
          sku: r.Product.sku,
          currentStock: r.Product.stock,
        } : null,
        quantity: r.quantity,
        reason: r.reason,
        status: r.status,
        requester: r.Requester ? {
          id: r.Requester.id,
          name: r.Requester.name,
          email: r.Requester.email,
        } : null,
        approver: r.Approver ? {
          id: r.Approver.id,
          name: r.Approver.name,
          email: r.Approver.email,
        } : null,
        createdAt: r.createdAt,
        approvedAt: r.approvedAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const approveStockRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await StockRequest.findOne({
      where: { id: requestId, ShopId: req.shopId },
      include: [
        { model: Product, attributes: ["id", "stock"] },
        { model: User, as: "Requester", attributes: ["id", "name"] },
      ],
    });

    if (!request) {
      return res.status(404).json({ message: "Stock request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: `Request is already ${request.status}.` });
    }

    const product = request.Product;
    const newStock = Number(product.stock || 0) + Number(request.quantity || 0);

    await request.update({
      status: "approved",
      approvedBy: req.user.id,
      approvedAt: new Date(),
    });

    await product.update({ stock: newStock });

    return res.json({
      id: request.id,
      status: request.status,
      approvedAt: request.approvedAt,
      approvedBy: {
        id: req.user.id,
        name: req.user.name,
      },
      productNewStock: newStock,
      message: `Stock request approved. ${request.Product.name} stock increased by ${request.quantity}.`,
    });
  } catch (error) {
    return next(error);
  }
};

const rejectStockRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;

    const request = await StockRequest.findOne({
      where: { id: requestId, ShopId: req.shopId },
      include: [{ model: User, as: "Requester", attributes: ["id", "name"] }],
    });

    if (!request) {
      return res.status(404).json({ message: "Stock request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: `Request is already ${request.status}.` });
    }

    await request.update({
      status: "rejected",
      approvedBy: req.user.id,
      rejectionReason: rejectionReason?.trim() || null,
      approvedAt: new Date(),
    });

    return res.json({
      id: request.id,
      status: request.status,
      rejectionReason: request.rejectionReason,
      approvedAt: request.approvedAt,
      message: "Stock request rejected.",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createStockRequest,
  listStockRequests,
  approveStockRequest,
  rejectStockRequest,
};
