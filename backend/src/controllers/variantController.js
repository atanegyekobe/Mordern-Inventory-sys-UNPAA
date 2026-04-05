const { Product, ProductVariant } = require("../models");
const { rejectCrossShopAccess } = require("../middleware/shopContext");

// Get all variants for a product
exports.getVariantsByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const variants = await ProductVariant.findAll({
      where: { ProductId: productId, ShopId: req.shopId },
      order: [["createdAt", "ASC"]],
    });
    res.json({ variants });
  } catch (error) {
    next(error);
  }
};

// Get single variant
exports.getVariant = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const variant = await ProductVariant.findOne({
      where: { id: variantId, ShopId: req.shopId },
      include: [{ model: Product, attributes: ["id", "name", "price"] }],
    });

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json({ variant });
  } catch (error) {
    next(error);
  }
};

// Create variant
exports.createVariant = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { attributes, sku, price, stock, imageUrl } = req.body;

    // Validate product exists
    const product = await Product.findByPk(productId, {
      where: { id: productId, ShopId: req.shopId },
      include: [{ association: "Category" }],
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Validate attributes
    if (!attributes || typeof attributes !== "object") {
      return res.status(400).json({ error: "Attributes must be a valid object" });
    }

    // Validate stock
    if (typeof stock !== "number" || stock < 0) {
      return res.status(400).json({ error: "Stock must be a non-negative number" });
    }

    // Validate against category template if it exists
    if (product.CategoryId) {
      const { CategoryVariantTemplate } = require("../models");
      const template = await CategoryVariantTemplate.findOne({
        where: { CategoryId: product.CategoryId },
      });

      if (template && template.attributeDefinitions && template.attributeDefinitions.length > 0) {
        const errors = [];
        const definitions = template.attributeDefinitions;

        // Check required attributes
        for (const def of definitions) {
          if (def.required && (!attributes[def.name] || String(attributes[def.name]).trim() === "")) {
            errors.push(`Attribute "${def.name}" is required.`);
          }

          // Validate type and values
          if (attributes[def.name] !== undefined && attributes[def.name] !== null) {
            const value = attributes[def.name];

            if (def.type === "number" && isNaN(Number(value))) {
              errors.push(`Attribute "${def.name}" must be a number.`);
            }

            if (def.type === "select" && !def.options.includes(String(value))) {
              errors.push(
                `Attribute "${def.name}" must be one of: ${def.options.join(", ")}`
              );
            }
          }
        }

        if (errors.length > 0) {
          return res.status(400).json({ error: "Validation errors", details: errors });
        }
      }
    }

    const variant = await ProductVariant.create({
      ShopId: req.shopId,
      ProductId: productId,
      attributes,
      sku: sku || null,
      price: price ? parseFloat(price) : null,
      stock: parseInt(stock) || 0,
      imageUrl: imageUrl || null,
    });

    res.status(201).json({ variant });
  } catch (error) {
    next(error);
  }
};

// Update variant
exports.updateVariant = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const { attributes, sku, price, stock, imageUrl, status } = req.body;

    const variant = await ProductVariant.findOne({ where: { id: variantId, ShopId: req.shopId } });
    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    if (rejectCrossShopAccess(variant.ShopId, req, res)) {
      return;
    }

    // Only allow updating specific fields
    if (attributes !== undefined) {
      if (typeof attributes !== "object") {
        return res.status(400).json({ error: "Attributes must be a valid object" });
      }
      variant.attributes = attributes;
    }

    if (sku !== undefined) variant.sku = sku;
    if (price !== undefined) variant.price = price ? parseFloat(price) : null;
    if (stock !== undefined) {
      if (typeof stock !== "number" || stock < 0) {
        return res.status(400).json({ error: "Stock must be a non-negative number" });
      }
      variant.stock = parseInt(stock);
    }
    if (imageUrl !== undefined) variant.imageUrl = imageUrl || null;
    if (status !== undefined && ["active", "inactive"].includes(status)) {
      variant.status = status;
    }

    await variant.save();
    res.json({ variant });
  } catch (error) {
    next(error);
  }
};

// Delete variant
exports.deleteVariant = async (req, res, next) => {
  try {
    const { variantId } = req.params;

    const variant = await ProductVariant.findOne({ where: { id: variantId, ShopId: req.shopId } });
    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    if (rejectCrossShopAccess(variant.ShopId, req, res)) {
      return;
    }

    await variant.destroy();
    res.json({ message: "Variant deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Bulk update variant stock
exports.updateVariantStock = async (req, res, next) => {
  try {
    const { variantId } = req.params;
    const { operation, value } = req.body;

    if (!["add", "subtract", "set"].includes(operation)) {
      return res.status(400).json({ 
        error: "Operation must be 'add', 'subtract', or 'set'" 
      });
    }

    if (typeof value !== "number" || value < 0) {
      return res.status(400).json({ error: "Value must be a non-negative number" });
    }

    const { sequelize } = require("../models");
    const { Op } = require("sequelize");

    const result = await sequelize.transaction(async (transaction) => {
      const variant = await ProductVariant.findByPk(variantId, {
          where: { id: variantId, ShopId: req.shopId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      
      if (!variant) {
        return { error: { status: 404, message: "Variant not found" } };
      }

      if (operation === "subtract") {
        if (variant.stock < value) {
          return {
            error: {
              status: 409,
              message: `Insufficient stock. Available: ${variant.stock}, requested subtract: ${value}.`,
            },
          };
        }

        const [updatedCount] = await ProductVariant.update(
          { stock: sequelize.literal(`stock - ${value}`) },
          {
            where: {
              id: variantId,
              ShopId: req.shopId,
              stock: { [Op.gte]: value },
            },
            transaction,
          }
        );

        if (updatedCount !== 1) {
          throw new Error(`Atomic stock decrement failed for variant ${variantId}.`);
        }
      } else if (operation === "add") {
        await ProductVariant.update(
          { stock: sequelize.literal(`stock + ${value}`) },
          { where: { id: variantId, ShopId: req.shopId }, transaction }
        );
      } else if (operation === "set") {
        await ProductVariant.update(
          { stock: value },
          { where: { id: variantId, ShopId: req.shopId }, transaction }
        );
      }
      
      const updatedVariant = await ProductVariant.findOne({
        where: { id: variantId, ShopId: req.shopId },
        transaction,
      });
      return { variant: updatedVariant };
    });

    if (result?.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    res.json({ variant: result.variant, message: `Variant stock updated to ${result.variant.stock}` });
  } catch (error) {
    next(error);
  }
};

// Get variant with stock info (for storefront)
exports.getVariantBySkuOrAttributes = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { sku, attributes } = req.query;

    let variant;
    if (sku) {
      variant = await ProductVariant.findOne({
        where: { ProductId: productId, sku, ShopId: req.shopId },
        include: [{ model: Product }],
      });
    } else if (attributes) {
      // Parse JSON attributes from query string
      const parsedAttrs = JSON.parse(decodeURIComponent(attributes));
      variant = await ProductVariant.findOne({
        where: {
          ProductId: productId,
          ShopId: req.shopId,
          attributes: sequelize.where(
            sequelize.literal("attributes"),
            "??",
            JSON.stringify(parsedAttrs)
          ),
        },
        include: [{ model: Product }],
      });
    }

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json({ variant });
  } catch (error) {
    next(error);
  }
};
