const { Shop, UserShop } = require("../models");
const { getShopConfig } = require("../services/shopService");

const readShopFromHost = (host) => {
  if (!host || typeof host !== "string") {
    return null;
  }

  const hostname = host.split(":")[0].trim().toLowerCase();
  const parts = hostname.split(".").filter(Boolean);

  // Future-proofing: support shop-slug.yourdomain.com
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
};

const resolveShopContext = async (req, res, next) => {
  try {
    const headerShopId =
      req.headers["x-shop-id"] ||
      req.headers["x-tenant-id"] ||
      null;
    const headerShopSlug = req.headers["x-shop-slug"] || readShopFromHost(req.headers.host);

    const tokenShopId = req.auth?.activeShopId || req.user?.activeShopId || req.user?.defaultShopId || null;

    let shop = null;

    if (headerShopId || tokenShopId) {
      const candidateId = String(headerShopId || tokenShopId);
      shop = await Shop.findByPk(candidateId);
    }

    if (!shop && headerShopSlug) {
      shop = await Shop.findOne({ where: { slug: String(headerShopSlug).toLowerCase() } });
    }

    if (!shop && !req.user) {
      const shopCount = await Shop.count();
      if (shopCount === 1) {
        shop = await Shop.findOne({ order: [["createdAt", "ASC"]] });
      }
    }

    if (!shop && req.user) {
      const memberships = await UserShop.findAll({
        where: { UserId: req.user.id },
        include: [
          {
            model: Shop,
            attributes: ["id", "name", "slug", "ownerId", "config"],
          },
        ],
        limit: 2,
      });

      const availableShops = memberships
        .map((membership) => membership.Shop)
        .filter(Boolean);

      if (availableShops.length === 1) {
        [shop] = availableShops;
      }

      if (!shop && availableShops.length > 1) {
        return res.status(400).json({
          message: "Multiple shops found. Provide x-shop-id or login with an active shop.",
        });
      }
    }

    if (!shop) {
      if (req.user) {
        return res.status(400).json({
          message: "Shop context is required. Provide x-shop-id or x-shop-slug.",
        });
      }

      return res.status(404).json({
        message: "No shop is available for this request.",
      });
    }

    let membership = null;
    if (req.user) {
      membership = await UserShop.findOne({
        where: {
          UserId: req.user.id,
          ShopId: shop.id,
        },
      });
    }

    const isOwner = req.user ? shop.ownerId === req.user.id : false;
    const isPlatformAdmin = req.user?.role === "admin";

    if (req.user && !membership && !isOwner && !isPlatformAdmin) {
      return res.status(403).json({
        message: "Access denied for this shop.",
      });
    }

    req.shopId = shop.id;
    req.shop = shop;
    req.shopMembershipRole = membership?.role || (isOwner ? "OWNER" : null);
    req.shopConfig = await getShopConfig(shop.id);
    return next();
  } catch (error) {
    return next(error);
  }
};

const rejectCrossShopAccess = (resourceShopId, req, res) => {
  if (!resourceShopId || resourceShopId !== req.shopId) {
    res.status(403).json({ message: "Cross-shop access is not allowed." });
    return true;
  }
  return false;
};

module.exports = {
  resolveShopContext,
  rejectCrossShopAccess,
};
