const { Category, Product, ProductVariant, sequelize } = require("../models");
const { Op } = require("sequelize");
const { rejectCrossShopAccess } = require("../middleware/shopContext");
const { majorToMinor, minorToMajor, ensureMinorInt } = require("../utils/money");
const {
  createInventoryLot,
  consumeInventoryLotsFifo,
} = require("../services/inventoryLotService");
const {
  getPublicProducts,
  getPublicProductById,
  getPublicProductBySlug,
} = require("../services/publicProductService");

const VALID_PRODUCT_STATUSES = new Set(["active", "draft"]);
const MAX_PRICE = 1000000;
const MAX_STOCK = 100000;

const normalizeProductStatusInput = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  // Backward compatibility for older clients that still submit "inactive".
  if (normalized === "inactive") {
    return "draft";
  }

  return normalized;
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const ensureAllProductsExist = async (productIds, shopId) => {
  const products = await Product.findAll({ where: { id: productIds, ShopId: shopId } });
  if (products.length !== productIds.length) {
    return null;
  }
  return products;
};

const loadOwnedProductOrRespond = async (req, res, productId) => {
  const product = await Product.findByPk(productId);
  if (!product) {
    res.status(404).json({ message: "Product not found." });
    return null;
  }

  if (product.ShopId !== req.shopId) {
    res.status(403).json({ message: "Access denied for this product." });
    return null;
  }

  return product;
};

const list = async (req, res, next) => {
  try {
    const includeAll = req.query.includeAll === "true";
    const where = includeAll
      ? { ShopId: req.shopId }
      : { status: "active", ShopId: req.shopId };
    const products = await Product.findAll({
      where,
      include: [
        { model: Category, where: { ShopId: req.shopId }, required: false },
        {
          model: ProductVariant,
          where: { ShopId: req.shopId },
          required: false,
          attributes: ["id", "attributes", "price", "stock"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
};

const listPublic = async (req, res, next) => {
  try {
    const { limit, offset, search, shopId, shopSlug } = req.query;
    const payload = await getPublicProducts({ limit, offset, search, shopId, shopSlug });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

const getPublicById = async (req, res, next) => {
  try {
    const product = await getPublicProductById(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
};

const getPublicBySlug = async (req, res, next) => {
  try {
    const { shopId, shopSlug } = req.query;
    const product = await getPublicProductBySlug(req.params.slug, { shopId, shopSlug });
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    return res.json({ product });
  } catch (error) {
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, ShopId: req.shopId },
      include: [
        { model: Category, where: { ShopId: req.shopId }, required: false },
        {
          model: ProductVariant,
          where: { ShopId: req.shopId },
          required: false,
          order: [["createdAt", "ASC"]],
        },
      ],
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
};

const getBySlug = async (req, res, next) => {
  try {
    const includeAll = req.query.includeAll === "true";
    const where = {
      slug: req.params.slug,
      ShopId: req.shopId,
    };

    if (!includeAll) {
      where.status = "active";
    }

    const product = await Product.findOne({
      where,
      include: [
        { model: Category, where: { ShopId: req.shopId }, required: false },
        {
          model: ProductVariant,
          where: { ShopId: req.shopId },
          required: false,
          order: [["createdAt", "ASC"]],
        },
      ],
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
    const { name, description, price, cost, sku, stock, status, categoryId } = req.body;
    if (!name || price === undefined || !categoryId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Validation: Price and cost
    const warnings = [];
    const priceDec = parseFloat(price);
    if (!Number.isFinite(priceDec) || priceDec < 0 || priceDec > MAX_PRICE) {
      return res.status(400).json({ message: `Price must be between 0 and ${MAX_PRICE}.` });
    }

    const stockValue = stock ?? 0;
    if (!Number.isInteger(stockValue) || stockValue < 0 || stockValue > MAX_STOCK) {
      return res.status(400).json({ message: `Stock must be an integer between 0 and ${MAX_STOCK}.` });
    }

    const costDec = cost ? parseFloat(cost) : null;

    if (costDec && priceDec < costDec) {
      warnings.push("Price is less than cost - this product will lose money.");
    }

    // Validation: SKU uniqueness
    if (sku) {
      const existingSku = await Product.findOne({ where: { sku, ShopId: req.shopId } });
      if (existingSku) {
        return res.status(400).json({ message: "SKU already exists for another product." });
      }
    }

    // Validation: Description
    if (!description || description.trim().length === 0) {
      warnings.push("Missing product description - consider adding one for better SEO and customer engagement.");
    }

    const category = await Category.findOne({ where: { id: categoryId, ShopId: req.shopId } });
    if (!category) {
      return res.status(400).json({ message: "Invalid category." });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const slug = slugify(name);
    const normalizedStatus =
      status === undefined ? "active" : normalizeProductStatusInput(status);

    if (!normalizedStatus || !VALID_PRODUCT_STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid product status." });
    }

    // Validate slug (should be non-empty and unique)
    if (!slug || slug.length === 0) {
      return res.status(400).json({ message: "Invalid product name - cannot generate slug." });
    }

    const existingSlug = await Product.findOne({ where: { slug, ShopId: req.shopId } });
    if (existingSlug) {
      return res.status(400).json({ message: "A product with this name already exists." });
    }

    const product = await Product.create({
      ShopId: req.shopId,
      name,
      slug,
      description,
      price: minorToMajor(majorToMinor(price)),
      priceMinor: majorToMinor(price),
      cost: costDec,
      costMinor: costDec === null ? null : majorToMinor(costDec),
      sku,
      stock: stockValue,
      status: normalizedStatus,
      imageUrl,
      CategoryId: categoryId,
    });

    if (stockValue > 0) {
      await createInventoryLot({
        shopId: req.shopId,
        productId: product.id,
        quantity: stockValue,
        sourceType: "INITIAL_STOCK",
        sourceRefId: product.id,
        note: "Initial stock recorded during product creation.",
        createdByUserId: req.user?.id,
        productQuantityBefore: 0,
      });
    }

    return res.status(201).json({ product, warnings: warnings.length > 0 ? warnings : null });
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const product = await loadOwnedProductOrRespond(req, res, req.params.id);
    if (!product) {
      return;
    }

    if (rejectCrossShopAccess(product.ShopId, req, res)) {
      return;
    }

    const warnings = [];
    const updates = {};

    // Handle name and slug
    if (req.body.name && req.body.name !== product.name) {
      updates.name = req.body.name;
      const newSlug = slugify(req.body.name);
      
      if (!newSlug || newSlug.length === 0) {
        return res.status(400).json({ message: "Invalid product name - cannot generate slug." });
      }

      const existingSlug = await Product.findOne({ 
        where: { slug: newSlug, id: { [Op.ne]: product.id }, ShopId: req.shopId } 
      });
      if (existingSlug) {
        return res.status(400).json({ message: "A product with this name already exists." });
      }
      updates.slug = newSlug;
    }

    // Handle price and cost
    if (req.body.price !== undefined || req.body.cost !== undefined) {
      const newPrice = req.body.price !== undefined ? parseFloat(req.body.price) : parseFloat(product.price);
      const newCost = req.body.cost !== undefined ? (req.body.cost ? parseFloat(req.body.cost) : null) : (product.cost ? parseFloat(product.cost) : null);

      if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice > MAX_PRICE) {
        return res.status(400).json({ message: `Price must be between 0 and ${MAX_PRICE}.` });
      }

      if (newCost && newPrice < newCost) {
        warnings.push("Price is less than cost - this product will lose money.");
      }

      if (req.body.price !== undefined) updates.price = newPrice;
      if (req.body.price !== undefined) updates.priceMinor = majorToMinor(newPrice);
      if (req.body.cost !== undefined) {
        updates.cost = newCost;
        updates.costMinor = newCost === null ? null : majorToMinor(newCost);
      }
    }

    // Handle SKU
    if (req.body.sku !== undefined) {
      if (req.body.sku && req.body.sku !== product.sku) {
        const existingSku = await Product.findOne({ 
          where: { sku: req.body.sku, id: { [Op.ne]: product.id }, ShopId: req.shopId } 
        });
        if (existingSku) {
          return res.status(400).json({ message: "SKU already exists for another product." });
        }
      }
      updates.sku = req.body.sku || null;
    }

    // Handle description
    if (req.body.description !== undefined) {
      updates.description = req.body.description;
      if (!req.body.description || req.body.description.trim().length === 0) {
        warnings.push("Missing product description - consider adding one for better SEO and customer engagement.");
      }
    } else if (!product.description || product.description.trim().length === 0) {
      warnings.push("Missing product description - consider adding one for better SEO and customer engagement.");
    }

    // Handle other fields
    if (req.body.stock !== undefined) {
      if (!Number.isInteger(req.body.stock) || req.body.stock < 0 || req.body.stock > MAX_STOCK) {
        return res.status(400).json({ message: `Stock must be an integer between 0 and ${MAX_STOCK}.` });
      }
      updates.stock = req.body.stock;
    }
    if (req.body.status !== undefined) {
      const normalizedStatus = normalizeProductStatusInput(req.body.status);
      if (!normalizedStatus || !VALID_PRODUCT_STATUSES.has(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid product status." });
      }
      updates.status = normalizedStatus;
    }
    if (req.body.categoryId !== undefined) {
      const category = await Category.findOne({ where: { id: req.body.categoryId, ShopId: req.shopId } });
      if (!category) {
        return res.status(400).json({ message: "Invalid category." });
      }
      updates.CategoryId = req.body.categoryId;
    }

    // Handle image only if file provided
    if (req.file) {
      updates.imageUrl = `/uploads/${req.file.filename}`;
    }

    await sequelize.transaction(async (transaction) => {
      const lockedProduct = await Product.findOne({
        where: { id: product.id, ShopId: req.shopId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!lockedProduct) {
        throw new Error("Product not found while processing update transaction.");
      }

      const stockBefore = ensureMinorInt(lockedProduct.stock);
      await lockedProduct.update(updates, { transaction });

      if (updates.stock !== undefined) {
        const stockAfter = ensureMinorInt(updates.stock);
        const delta = stockAfter - stockBefore;

        if (delta > 0) {
          await createInventoryLot({
            shopId: req.shopId,
            productId: lockedProduct.id,
            quantity: delta,
            sourceType: "MANUAL_STOCK_SET",
            sourceRefId: lockedProduct.id,
            note: `Stock manually set from ${stockBefore} to ${stockAfter}.`,
            createdByUserId: req.user?.id,
            productQuantityBefore: stockBefore,
            transaction,
          });
        }

        if (delta < 0) {
          await consumeInventoryLotsFifo({
            shopId: req.shopId,
            product: lockedProduct,
            quantity: Math.abs(delta),
            reason: "MANUAL_STOCK_SET",
            referenceType: "PRODUCT_UPDATE",
            referenceId: lockedProduct.id,
            note: `Stock manually set from ${stockBefore} to ${stockAfter}.`,
            createdByUserId: req.user?.id,
            productQuantityBefore: stockBefore,
            transaction,
          });
        }
      }
    });
    
    // Reload product to ensure fresh data is returned
    const updatedProduct = await Product.findOne({
      where: { id: product.id, ShopId: req.shopId },
      include: [
        { model: Category, where: { ShopId: req.shopId }, required: false },
        { model: ProductVariant, where: { ShopId: req.shopId }, required: false },
      ],
    });

    return res.json({ product: updatedProduct, warnings: warnings.length > 0 ? warnings : null });
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const product = await loadOwnedProductOrRespond(req, res, req.params.id);
    if (!product) {
      return;
    }

    await product.destroy();
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

// Bulk operations
const bulkUpdatePrice = async (req, res, next) => {
  try {
    const { productIds, operation, value } = req.body;

    const products = await ensureAllProductsExist(productIds, req.shopId);
    if (!products) {
      return res.status(404).json({ message: "One or more products were not found." });
    }
    
    for (const product of products) {
      let newPrice;
      const previousPrice = parseFloat(product.price);
      const previousPriceMinor = majorToMinor(previousPrice);
      
      if (operation === "increase") {
        // Calculate adjustment in minor units to avoid floating-point errors
        const adjustmentBasisPoints = Math.round(value * 100);
        const adjustmentMinor = Math.floor((previousPriceMinor * adjustmentBasisPoints) / 10000);
        const newPriceMinor = previousPriceMinor + adjustmentMinor;
        newPrice = minorToMajor(newPriceMinor);
      } else if (operation === "decrease") {
        // Calculate adjustment in minor units to avoid floating-point errors
        const adjustmentBasisPoints = Math.round(value * 100);
        const adjustmentMinor = Math.floor((previousPriceMinor * adjustmentBasisPoints) / 10000);
        const newPriceMinor = Math.max(previousPriceMinor - adjustmentMinor, 0);
        newPrice = minorToMajor(newPriceMinor);
      } else if (operation === "set") {
        newPrice = value;
      }

      if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice > MAX_PRICE) {
        return res.status(400).json({
          message: `Computed price is out of allowed bounds (0 to ${MAX_PRICE}).`,
        });
      }

      const newPriceMinor = majorToMinor(newPrice);
      await product.update({ 
        price: minorToMajor(newPriceMinor),
        priceMinor: newPriceMinor,
        compareAtPrice: previousPrice,
        compareAtPriceMinor: majorToMinor(previousPrice),
      });
    }

    return res.json({ updated: products.length });
  } catch (error) {
    return next(error);
  }
};

const bulkUpdateCategory = async (req, res, next) => {
  try {
    const { productIds, categoryId } = req.body;

    const category = await Category.findOne({ where: { id: categoryId, ShopId: req.shopId } });
    if (!category) {
      return res.status(400).json({ message: "Invalid category." });
    }

    const products = await ensureAllProductsExist(productIds, req.shopId);
    if (!products) {
      return res.status(404).json({ message: "One or more products were not found." });
    }

    const updated = await Product.update(
      { CategoryId: categoryId },
      { where: { id: productIds, ShopId: req.shopId } }
    );

    return res.json({ updated: updated[0] });
  } catch (error) {
    return next(error);
  }
};

const bulkUpdateStock = async (req, res, next) => {
  try {
    const { productIds, operation, value } = req.body;
    const batchRefId = `bulk-stock:${Date.now()}`;
    
    if (!productIds || productIds.length === 0) {
      return res.status(400).json({ message: "At least one product ID is required." });
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > MAX_STOCK) {
      return res.status(400).json({
        message: `Stock value must be between 0 and ${MAX_STOCK}.`,
      });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const products = await Product.findAll({
        where: { id: productIds, ShopId: req.shopId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (products.length !== productIds.length) {
        return {
          error: {
            status: 404,
            body: { message: "One or more products were not found." },
          },
        };
      }

      if (operation === "add") {
        for (const product of products) {
          const stockBefore = ensureMinorInt(product.stock);
          const stockAfter = stockBefore + numericValue;

          await Product.update(
            { stock: sequelize.literal(`stock + ${numericValue}`) },
            { where: { id: product.id, ShopId: req.shopId }, transaction }
          );

          await createInventoryLot({
            shopId: req.shopId,
            productId: product.id,
            quantity: numericValue,
            sourceType: "BULK_STOCK_ADD",
            sourceRefId: batchRefId,
            note: `Bulk stock add of ${numericValue} unit(s).`,
            createdByUserId: req.user?.id,
            productQuantityBefore: stockBefore,
            transaction,
          });
        }
      } else if (operation === "subtract") {
        const insufficient = products.filter((product) => product.stock < numericValue);
        if (insufficient.length > 0) {
          return {
            error: {
              status: 409,
              body: {
                message: "Insufficient stock for one or more products.",
                insufficientProducts: insufficient.map((product) => ({
                  id: product.id,
                  name: product.name,
                  available: product.stock,
                  requestedDecrement: numericValue,
                })),
              },
            },
          };
        }

        for (const product of products) {
          const stockBefore = ensureMinorInt(product.stock);
          const stockAfter = stockBefore - numericValue;

          const [updatedCount] = await Product.update(
            { stock: sequelize.literal(`stock - ${numericValue}`) },
            {
              where: {
                id: product.id,
                ShopId: req.shopId,
                stock: { [Op.gte]: numericValue },
              },
              transaction,
            }
          );

          if (updatedCount !== 1) {
            throw new Error(`Atomic stock decrement failed for product ${product.id}.`);
          }

          await consumeInventoryLotsFifo({
            shopId: req.shopId,
            product,
            quantity: numericValue,
            reason: "BULK_STOCK_SUBTRACT",
            referenceType: "BULK_STOCK",
            referenceId: batchRefId,
            note: `Bulk stock subtract of ${numericValue} unit(s).`,
            createdByUserId: req.user?.id,
            productQuantityBefore: stockBefore,
            transaction,
          });
        }
      } else if (operation === "set") {
        for (const product of products) {
          const stockBefore = ensureMinorInt(product.stock);
          const stockAfter = numericValue;

          await Product.update(
            { stock: numericValue },
            { where: { id: product.id, ShopId: req.shopId }, transaction }
          );

          const delta = stockAfter - stockBefore;
          if (delta > 0) {
            await createInventoryLot({
              shopId: req.shopId,
              productId: product.id,
              quantity: delta,
              sourceType: "BULK_STOCK_SET",
              sourceRefId: batchRefId,
              note: `Bulk stock set from ${stockBefore} to ${stockAfter}.`,
              createdByUserId: req.user?.id,
              productQuantityBefore: stockBefore,
              transaction,
            });
          }

          if (delta < 0) {
            await consumeInventoryLotsFifo({
              shopId: req.shopId,
              product,
              quantity: Math.abs(delta),
              reason: "BULK_STOCK_SET",
              referenceType: "BULK_STOCK",
              referenceId: batchRefId,
              note: `Bulk stock set from ${stockBefore} to ${stockAfter}.`,
              createdByUserId: req.user?.id,
              productQuantityBefore: stockBefore,
              transaction,
            });
          }
        }
        return { updated: products.length };
      } else {
        return {
          error: {
            status: 400,
            body: { message: "Invalid stock operation." },
          },
        };
      }

      return { updated: products.length };
    });

    if (result?.error) {
      return res.status(result.error.status).json(result.error.body);
    }

    return res.json({ updated: result.updated });
  } catch (error) {
    return next(error);
  }
};

const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { productIds, status: newStatus } = req.body;

    const normalizedStatus = normalizeProductStatusInput(newStatus);
    if (!normalizedStatus || !VALID_PRODUCT_STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid product status." });
    }

    const products = await ensureAllProductsExist(productIds, req.shopId);
    if (!products) {
      return res.status(404).json({ message: "One or more products were not found." });
    }

    const updated = await Product.update(
      { status: normalizedStatus },
      { where: { id: productIds, ShopId: req.shopId } }
    );

    return res.json({ updated: updated[0] });
  } catch (error) {
    return next(error);
  }
};

const bulkDelete = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    const products = await ensureAllProductsExist(productIds, req.shopId);
    if (!products) {
      return res.status(404).json({ message: "One or more products were not found." });
    }

    const deleted = await Product.destroy({
      where: { id: productIds, ShopId: req.shopId },
    });

    return res.json({ deleted });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPublic,
  getPublicById,
  getPublicBySlug,
  list,
  getById,
  getBySlug,
  create,
  update,
  remove,
  bulkUpdatePrice,
  bulkUpdateCategory,
  bulkUpdateStock,
  bulkUpdateStatus,
  bulkDelete,
};
