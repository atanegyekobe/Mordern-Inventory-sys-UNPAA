const { Shop } = require("../models");
const { createShopForUser, getShopConfig } = require("../services/shopService");

const create = async (req, res, next) => {
  try {
    const { name, config = {}, createDefaultCategories = true } = req.body;

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ message: "Shop name is required." });
    }

    const shop = await createShopForUser({
      ownerId: req.user.id,
      name: String(name).trim(),
      config,
      createDefaultCategories: createDefaultCategories !== false,
    });

    return res.status(201).json({
      shop: {
        ...shop.toJSON(),
        config: await getShopConfig(shop.id),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listMine = async (req, res, next) => {
  try {
    const shops = await Shop.findAll({
      where: { ownerId: req.user.id },
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      shops: await Promise.all(
        shops.map(async (shop) => ({
          ...shop.toJSON(),
          config: await getShopConfig(shop.id),
        }))
      ),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  create,
  listMine,
};
