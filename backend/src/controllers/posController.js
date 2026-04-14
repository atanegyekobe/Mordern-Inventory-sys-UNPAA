const { Op } = require("sequelize");
const { Product, Category } = require("../models");
const { createPosSale, PosSaleError } = require("../services/posSaleService");

const POS_SEARCH_LIMIT = 20;

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
    });

    return res.status(201).json(payload);
  } catch (error) {
    if (error instanceof PosSaleError) {
      return res.status(error.status).json({ message: error.message });
    }

    return next(error);
  }
};

module.exports = {
  listProducts,
  searchProducts,
  createSale,
};
