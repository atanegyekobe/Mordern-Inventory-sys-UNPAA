const { Category } = require("../models");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const list = async (req, res, next) => {
  try {
    const categories = await Category.findAll({ order: [["name", "ASC"]] });
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    const category = await Category.create({
      name,
      slug: slug ? slugify(slug) : slugify(name),
    });

    return res.status(201).json({ category });
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;
    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    await category.update({
      name: name ?? category.name,
      slug: slug ? slugify(slug) : category.slug,
    });

    return res.json({ category });
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
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
