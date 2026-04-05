const { Op } = require("sequelize");
const { Product, ProductVariant, Category, Shop } = require("../models");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toSafeInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildSearchWhere = (search) => {
  const normalized = String(search || "").trim();
  if (!normalized) {
    return {};
  }

  return {
    [Op.or]: [
      { name: { [Op.iLike]: `%${normalized}%` } },
      { sku: { [Op.iLike]: `%${normalized}%` } },
    ],
  };
};

const buildShopWhere = ({ shopId, shopSlug }) => {
  const normalizedSlug = String(shopSlug || "").trim();
  if (normalizedSlug) {
    return { slug: normalizedSlug };
  }

  if (shopId !== undefined && shopId !== null && String(shopId).trim() !== "") {
    const parsedShopId = Number.parseInt(String(shopId), 10);
    if (!Number.isFinite(parsedShopId)) {
      return { id: -1 };
    }
    return { id: parsedShopId };
  }

  return undefined;
};

const getPublicProducts = async ({ limit, offset, search, shopId, shopSlug }) => {
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, toSafeInt(limit, DEFAULT_LIMIT)));
  const safeOffset = Math.max(0, toSafeInt(offset, 0));
  const shopWhere = buildShopWhere({ shopId, shopSlug });

  const where = {
    status: "active",
    ...buildSearchWhere(search),
  };

  const result = await Product.findAndCountAll({
    where,
    include: [
      {
        model: Category,
        attributes: ["id", "name", "slug", "ParentId"],
        include: [{ model: Category, as: "Parent", attributes: ["id", "name", "slug"] }],
        required: false,
      },
      {
        model: Shop,
        attributes: ["id", "name", "slug"],
        required: true,
        where: shopWhere,
      },
    ],
    attributes: [
      "id",
      "name",
      "slug",
      "price",
      "imageUrl",
      "stock",
      "createdAt",
      "sku",
      "CategoryId",
      "status",
    ],
    order: [["createdAt", "DESC"]],
    limit: safeLimit,
    offset: safeOffset,
  });

  const products = result.rows.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    image: product.imageUrl,
    imageUrl: product.imageUrl,
    stock: product.stock,
    status: product.status,
    CategoryId: product.CategoryId,
    Category: product.Category || null,
    shop_id: product.Shop?.id || null,
    shop_name: product.Shop?.name || null,
    shop_slug: product.Shop?.slug || null,
  }));

  return {
    products,
    pagination: {
      total: result.count,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + products.length < result.count,
    },
  };
};

const getPublicProductById = async (productId) => {
  const product = await Product.findOne({
    where: {
      id: productId,
      status: "active",
    },
    include: [
      {
        model: Category,
        attributes: ["id", "name", "slug", "ParentId"],
        include: [{ model: Category, as: "Parent", attributes: ["id", "name", "slug"] }],
        required: false,
      },
      {
        model: ProductVariant,
        where: { status: "active" },
        required: false,
        order: [["createdAt", "ASC"]],
      },
      {
        model: Shop,
        attributes: ["id", "name", "slug"],
        required: true,
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!product) {
    return null;
  }

  return {
    ...product.toJSON(),
    shop: {
      id: product.Shop?.id || null,
      name: product.Shop?.name || null,
      slug: product.Shop?.slug || null,
    },
  };
};

const getPublicProductBySlug = async (slug, { shopId, shopSlug } = {}) => {
  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) {
    return null;
  }

  const shopWhere = buildShopWhere({ shopId, shopSlug });

  const product = await Product.findOne({
    where: {
      slug: normalizedSlug,
      status: "active",
    },
    include: [
      {
        model: Category,
        attributes: ["id", "name", "slug", "ParentId"],
        include: [{ model: Category, as: "Parent", attributes: ["id", "name", "slug"] }],
        required: false,
      },
      {
        model: ProductVariant,
        where: { status: "active" },
        required: false,
        order: [["createdAt", "ASC"]],
      },
      {
        model: Shop,
        attributes: ["id", "name", "slug"],
        required: true,
        where: shopWhere,
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!product) {
    return null;
  }

  return {
    ...product.toJSON(),
    shop: {
      id: product.Shop?.id || null,
      name: product.Shop?.name || null,
      slug: product.Shop?.slug || null,
    },
  };
};

module.exports = {
  getPublicProducts,
  getPublicProductById,
  getPublicProductBySlug,
};