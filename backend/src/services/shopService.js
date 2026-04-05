const crypto = require("crypto");
const { Shop, Category, UserShop, sequelize } = require("../models");

const DEFAULT_SHOP_CONFIG = {
  branding: {
    logo: "",
    primaryColor: "#0f172a",
    currency: "GHS",
  },
  features: {
    couponsEnabled: true,
    taxEnabled: false,
  },
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const mergeShopConfig = (config = {}) => ({
  branding: {
    ...DEFAULT_SHOP_CONFIG.branding,
    ...(config.branding || {}),
  },
  features: {
    ...DEFAULT_SHOP_CONFIG.features,
    ...(config.features || {}),
  },
});

const getShopConfig = async (shopId) => {
  if (!shopId) {
    return mergeShopConfig();
  }

  const shop = await Shop.findByPk(shopId);
  if (!shop) {
    return mergeShopConfig();
  }

  return mergeShopConfig(shop.config || {});
};

const buildUniqueShopSlug = async (name, transaction = null) => {
  const baseSlug = slugify(name) || `shop-${crypto.randomBytes(4).toString("hex")}`;
  let slug = baseSlug;
  let counter = 0;

  while (await Shop.findOne({ where: { slug }, transaction })) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
};

const createDefaultCategories = async (shopId, transaction) => {
  const defaults = [
    { name: "Featured", slug: "featured" },
    { name: "New Arrivals", slug: "new-arrivals" },
    { name: "Essentials", slug: "essentials" },
  ];

  for (const category of defaults) {
    try {
      await Category.findOrCreate({
        where: { ShopId: shopId, slug: category.slug },
        defaults: {
          ShopId: shopId,
          name: category.name,
          slug: category.slug,
        },
        transaction,
      });
    } catch (error) {
      // Defensive fallback for legacy databases that still enforce global slug uniqueness.
      if (error?.name !== "SequelizeUniqueConstraintError") {
        throw error;
      }

      const existing = await Category.findOne({
        where: { ShopId: shopId, slug: category.slug },
        transaction,
      });

      if (existing) {
        continue;
      }

      await Category.findOrCreate({
        where: { ShopId: shopId, slug: `${category.slug}-${String(shopId).slice(0, 8)}` },
        defaults: {
          ShopId: shopId,
          name: category.name,
          slug: `${category.slug}-${String(shopId).slice(0, 8)}`,
        },
        transaction,
      });
    }
  }
};

const createShopForUser = async ({
  ownerId,
  name,
  config = {},
  createDefaultCategories: shouldCreateDefaultCategories = true,
  transaction: existingTransaction = null,
}) => {
  const run = async (transaction) => {
    const slug = await buildUniqueShopSlug(name, transaction);
    const shop = await Shop.create(
      {
        name,
        slug,
        ownerId,
        config: mergeShopConfig(config),
      },
      { transaction }
    );

    await UserShop.findOrCreate({
      where: {
        UserId: ownerId,
        ShopId: shop.id,
      },
      defaults: {
        UserId: ownerId,
        ShopId: shop.id,
        role: "OWNER",
      },
      transaction,
    });

    if (shouldCreateDefaultCategories) {
      await createDefaultCategories(shop.id, transaction);
    }

    return shop;
  };

  if (existingTransaction) {
    return run(existingTransaction);
  }

  return sequelize.transaction(run);
};

module.exports = {
  DEFAULT_SHOP_CONFIG,
  getShopConfig,
  mergeShopConfig,
  buildUniqueShopSlug,
  createShopForUser,
};
