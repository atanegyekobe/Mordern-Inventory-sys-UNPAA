const { CategoryVariantTemplate, Category } = require("../models");

// Get template for a category
exports.getTemplate = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const template = await CategoryVariantTemplate.findOne({
      where: { CategoryId: categoryId },
      include: [{ model: Category, attributes: ["id", "name"], where: { ShopId: req.shopId } }],
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found for this category." });
    }

    res.json({ template });
  } catch (error) {
    next(error);
  }
};

// Create or update template for a category
exports.upsertTemplate = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { attributeDefinitions, description } = req.body;

    // Verify category exists
    const category = await Category.findOne({ where: { id: categoryId, ShopId: req.shopId } });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    // Validate attributeDefinitions
    if (!Array.isArray(attributeDefinitions)) {
      return res.status(400).json({ message: "attributeDefinitions must be an array." });
    }

    // Validate each attribute definition
    const validTypes = ["text", "number", "select", "color"];
    for (const attr of attributeDefinitions) {
      if (!attr.name || !attr.type || !validTypes.includes(attr.type)) {
        return res.status(400).json({
          message: `Invalid attribute: name and type (${validTypes.join(", ")}) are required.`,
        });
      }
      if (attr.type === "select" && (!Array.isArray(attr.options) || attr.options.length === 0)) {
        return res
          .status(400)
          .json({ message: `Select type attribute "${attr.name}" must have options.` });
      }
    }

    // Find or create template
    const [template] = await CategoryVariantTemplate.findOrCreate({
      where: { CategoryId: categoryId },
      defaults: { attributeDefinitions, description: description || null },
    });

    // If exists, update it
    if (!template.isNewRecord || template.changed().length > 0) {
      await template.update({ attributeDefinitions, description: description || null });
    }

    // Reload with association
    const updatedTemplate = await CategoryVariantTemplate.findByPk(template.id, {
      include: [{ model: Category, attributes: ["id", "name"], where: { ShopId: req.shopId } }],
    });

    res.json({ template: updatedTemplate, message: "Template saved successfully." });
  } catch (error) {
    next(error);
  }
};

// Validate variant against category template
exports.validateVariant = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { attributes } = req.body;

    const template = await CategoryVariantTemplate.findOne({
      where: { CategoryId: categoryId },
    });

    if (!template || !template.attributeDefinitions || template.attributeDefinitions.length === 0) {
      // No template defined, variant is valid
      return res.json({ valid: true, message: "No template defined for this category." });
    }

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

        if (def.type === "color") {
          // Basic color validation (hex or named color)
          const colorRegex = /^(#([0-9a-fA-F]{3}){1,2}|[a-zA-Z]+)$/;
          if (!colorRegex.test(String(value))) {
            errors.push(`Attribute "${def.name}" is not a valid color.`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    res.json({ valid: true, message: "Variant attributes are valid." });
  } catch (error) {
    next(error);
  }
};
