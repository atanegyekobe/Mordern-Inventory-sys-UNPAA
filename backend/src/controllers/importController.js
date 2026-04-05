const { parse } = require("csv-parse/sync");
const { Category, Product } = require("../models");
const { Op } = require("sequelize");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

// Preview CSV import with validation
const previewImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No CSV file uploaded." });
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString("utf-8");
    let records;
    
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError) {
      return res.status(400).json({ 
        message: "Invalid CSV format.", 
        error: parseError.message 
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ message: "CSV file is empty." });
    }

    // Get all categories for validation
    const categories = await Category.findAll({ where: { ShopId: req.shopId } });
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat.id;
      categoryMap[cat.id] = cat.id;
    });

    // Get existing SKUs and slugs for duplicate checking
    const existingProducts = await Product.findAll({
      attributes: ["sku", "slug"],
      where: { ShopId: req.shopId },
    });
    const existingSkus = new Set(
      existingProducts.filter(p => p.sku).map(p => p.sku.toLowerCase())
    );
    const existingSlugs = new Set(
      existingProducts.map(p => p.slug.toLowerCase())
    );

    // Validate each row
    const preview = records.map((row, index) => {
      const errors = [];
      const warnings = [];
      const rowNumber = index + 2; // +2 because index starts at 0 and row 1 is header

      // Required fields
      if (!row.name || row.name.trim().length === 0) {
        errors.push("Name is required");
      }

      if (!row.price || isNaN(parseFloat(row.price))) {
        errors.push("Valid price is required");
      } else {
        const price = parseFloat(row.price);
        if (price < 0) {
          errors.push("Price cannot be negative");
        }
        
        // Check price vs cost
        if (row.cost && !isNaN(parseFloat(row.cost))) {
          const cost = parseFloat(row.cost);
          if (cost > price) {
            warnings.push("Price is less than cost");
          }
        }
      }

      if (!row.category || row.category.trim().length === 0) {
        errors.push("Category is required");
      } else {
        const categoryKey = row.category.toLowerCase();
        if (!categoryMap[categoryKey]) {
          errors.push(`Category '${row.category}' not found`);
        }
      }

      // Optional but validated fields
      if (row.stock && isNaN(parseInt(row.stock))) {
        errors.push("Stock must be a number");
      }

      if (row.cost && !isNaN(parseFloat(row.cost)) && parseFloat(row.cost) < 0) {
        errors.push("Cost cannot be negative");
      }

      if (row.status && !["active", "draft"].includes(row.status.toLowerCase())) {
        errors.push("Status must be 'active' or 'draft'");
      }

      // Check for duplicates
      if (row.sku && row.sku.trim().length > 0) {
        const skuLower = row.sku.toLowerCase();
        if (existingSkus.has(skuLower)) {
          errors.push(`SKU '${row.sku}' already exists`);
        }
      }

      if (row.name && row.name.trim().length > 0) {
        const slug = slugify(row.name);
        if (existingSlugs.has(slug)) {
          errors.push(`Product name generates duplicate slug: '${slug}'`);
        }
      }

      // Check description
      if (!row.description || row.description.trim().length === 0) {
        warnings.push("Missing description");
      }

      return {
        rowNumber,
        data: {
          name: row.name || "",
          description: row.description || "",
          price: row.price || "",
          cost: row.cost || "",
          sku: row.sku || "",
          stock: row.stock || "0",
          status: row.status || "active",
          category: row.category || "",
        },
        errors,
        warnings,
        isValid: errors.length === 0,
      };
    });

    const validCount = preview.filter(p => p.isValid).length;
    const errorCount = preview.filter(p => !p.isValid).length;

    return res.json({
      preview,
      summary: {
        total: preview.length,
        valid: validCount,
        invalid: errorCount,
      },
      columns: Object.keys(records[0] || {}),
    });
  } catch (error) {
    return next(error);
  }
};

// Execute CSV import
const executeImport = async (req, res, next) => {
  try {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No rows to import." });
    }

    // Get all categories
    const categories = await Category.findAll({ where: { ShopId: req.shopId } });
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat.id;
      categoryMap[cat.id] = cat.id;
    });

    const results = {
      successful: [],
      failed: [],
    };

    // Import each row
    for (const row of rows) {
      try {
        // Only import valid rows
        if (!row.isValid) {
          results.failed.push({
            rowNumber: row.rowNumber,
            data: row.data,
            error: "Row has validation errors",
          });
          continue;
        }

        const categoryId = categoryMap[row.data.category.toLowerCase()];
        
        if (!categoryId) {
          results.failed.push({
            rowNumber: row.rowNumber,
            data: row.data,
            error: "Category not found",
          });
          continue;
        }

        const product = await Product.create({
          ShopId: req.shopId,
          name: row.data.name,
          slug: slugify(row.data.name),
          description: row.data.description || null,
          price: parseFloat(row.data.price),
          cost: row.data.cost ? parseFloat(row.data.cost) : null,
          sku: row.data.sku || null,
          stock: parseInt(row.data.stock) || 0,
          status: row.data.status.toLowerCase() || "active",
          CategoryId: categoryId,
          imageUrl: null,
        });

        results.successful.push({
          rowNumber: row.rowNumber,
          productId: product.id,
          name: product.name,
        });
      } catch (error) {
        results.failed.push({
          rowNumber: row.rowNumber,
          data: row.data,
          error: error.message,
        });
      }
    }

    return res.json({
      results,
      summary: {
        successful: results.successful.length,
        failed: results.failed.length,
        total: rows.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  previewImport,
  executeImport,
};
