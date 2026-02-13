const { Category, Product } = require("../models");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const list = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      include: [{ model: Category }],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Category }],
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, description, price, sku, stock, status, categoryId } = req.body;
    if (!name || !price || !categoryId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(400).json({ message: "Invalid category." });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const product = await Product.create({
      name,
      slug: slugify(name),
      description,
      price,
      sku,
      stock: stock ?? 0,
      status: status ?? "active",
      imageUrl,
      CategoryId: categoryId,
    });

    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : product.imageUrl;

    await product.update({
      name: req.body.name ?? product.name,
      slug: req.body.name ? slugify(req.body.name) : product.slug,
      description: req.body.description ?? product.description,
      price: req.body.price ?? product.price,
      sku: req.body.sku ?? product.sku,
      stock: req.body.stock ?? product.stock,
      status: req.body.status ?? product.status,
      imageUrl,
      CategoryId: req.body.categoryId ?? product.CategoryId,
    });

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    await product.destroy();
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
