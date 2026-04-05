const { Category } = require("../models");
const { rejectCrossShopAccess } = require("../middleware/shopContext");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const normalizeParentId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return String(value);
};

const ensureNoCircularParent = async (categoryId, parentId, shopId) => {
  let currentId = parentId;

  while (currentId) {
    if (currentId === categoryId) {
      return false;
    }

    const current = await Category.findOne({
      where: { id: currentId, ShopId: shopId },
      attributes: ["id", "ParentId"],
    });

    if (!current) {
      break;
    }

    currentId = current.ParentId;
  }

  return true;
};

const list = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      where: { ShopId: req.shopId },
      include: [{ model: Category, as: "Parent", attributes: ["id", "name", "slug"] }],
      order: [["name", "ASC"]],
    });
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, slug, parentId } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    const normalizedParentId = normalizeParentId(parentId);
    if (normalizedParentId) {
      const parentCategory = await Category.findOne({
        where: { id: normalizedParentId, ShopId: req.shopId },
      });
      if (!parentCategory) {
        return res.status(400).json({ message: "Invalid parent category." });
      }
    }

    const normalizedSlug = slug ? slugify(slug) : slugify(name);
    const existingSlug = await Category.findOne({
      where: { ShopId: req.shopId, slug: normalizedSlug },
    });
    if (existingSlug) {
      return res.status(409).json({ message: "A category with this slug already exists in this shop." });
    }

    const category = await Category.create({
      ShopId: req.shopId,
      name,
      slug: normalizedSlug,
      ParentId: normalizedParentId,
    });

    return res.status(201).json({ category });
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug, parentId } = req.body;
    const category = await Category.findOne({ where: { id, ShopId: req.shopId } });

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    if (rejectCrossShopAccess(category.ShopId, req, res)) {
      return;
    }

    const updates = {
      name: name ?? category.name,
      slug: slug ? slugify(slug) : category.slug,
    };

    if (updates.slug !== category.slug) {
      const existingSlug = await Category.findOne({
        where: { ShopId: req.shopId, slug: updates.slug },
      });
      if (existingSlug && existingSlug.id !== category.id) {
        return res.status(409).json({ message: "A category with this slug already exists in this shop." });
      }
    }

    if (parentId !== undefined) {
      const normalizedParentId = normalizeParentId(parentId);

      if (normalizedParentId === id) {
        return res.status(400).json({ message: "A category cannot be its own parent." });
      }

      if (normalizedParentId) {
        const parentCategory = await Category.findOne({
          where: { id: normalizedParentId, ShopId: req.shopId },
        });
        if (!parentCategory) {
          return res.status(400).json({ message: "Invalid parent category." });
        }

        const isValidHierarchy = await ensureNoCircularParent(id, normalizedParentId, req.shopId);
        if (!isValidHierarchy) {
          return res.status(400).json({ message: "Circular category hierarchy is not allowed." });
        }
      }

      updates.ParentId = normalizedParentId;
    }

    await category.update(updates);

    return res.json({ category });
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ where: { id, ShopId: req.shopId } });

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    if (rejectCrossShopAccess(category.ShopId, req, res)) {
      return;
    }

    const childCount = await Category.count({ where: { ParentId: id, ShopId: req.shopId } });
    if (childCount > 0) {
      return res.status(409).json({
        message: `Cannot delete category with ${childCount} subcategory(ies). Move or delete subcategories first.`,
        childCount,
      });
    }

    await category.destroy();
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  create,
  update,
  remove,
};
