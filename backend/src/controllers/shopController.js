const { Shop, User, UserShop } = require("../models");
const { createShopForUser, getShopConfig, mergeShopConfig } = require("../services/shopService");
const { rejectCrossShopAccess } = require("../middleware/shopContext");

const normalizeLogoUrl = (value) => {
  if (value === undefined) {
    return { provided: false, value: null, error: null };
  }

  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return { provided: true, value: "", error: null };
  }

  if (trimmed.length > 500) {
    return { provided: true, value: null, error: "Logo URL must be 500 characters or fewer." };
  }

  const isAbsoluteUrl = /^https?:\/\//i.test(trimmed);
  const isRelativeAssetPath = trimmed.startsWith("/");

  if (!isAbsoluteUrl && !isRelativeAssetPath) {
    return {
      provided: true,
      value: null,
      error: "Logo must be an absolute URL (http/https) or a relative path starting with '/'.",
    };
  }

  return { provided: true, value: trimmed, error: null };
};

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

const updateName = async (req, res, next) => {
  try {
    if (rejectCrossShopAccess(req.params.shopId, req, res)) {
      return;
    }

    const hasNameInput = req.body?.name !== undefined;
    const nextName = String(req.body?.name || "").trim();
    const nextLogo = normalizeLogoUrl(req.body?.logoUrl);

    if (!hasNameInput && !nextLogo.provided) {
      return res.status(400).json({ message: "Provide at least one field to update." });
    }

    if (hasNameInput && !nextName) {
      return res.status(400).json({ message: "Shop name is required." });
    }

    if (hasNameInput && nextName.length > 160) {
      return res.status(400).json({ message: "Shop name must be 160 characters or fewer." });
    }

    if (nextLogo.error) {
      return res.status(400).json({ message: nextLogo.error });
    }

    const shop = await Shop.findByPk(req.shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    const isPlatformAdmin = req.user?.role === "admin";
    const isOwner = shop.ownerId === req.user?.id || req.shopMembershipRole === "OWNER";

    if (!isPlatformAdmin && !isOwner) {
      return res.status(403).json({ message: "Only the shop owner can update this shop identity." });
    }

    let hasChanges = false;

    if (hasNameInput && shop.name !== nextName) {
      shop.name = nextName;
      hasChanges = true;
    }

    if (nextLogo.provided) {
      const mergedConfig = mergeShopConfig(shop.config || {});
      if (mergedConfig.branding.logo !== nextLogo.value) {
        shop.config = {
          ...mergedConfig,
          branding: {
            ...mergedConfig.branding,
            logo: nextLogo.value,
          },
        };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await shop.save();
    }

    return res.json({
      shop: {
        ...shop.toJSON(),
        config: await getShopConfig(shop.id),
      },
      message: "Shop details updated successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

const uploadLogo = async (req, res, next) => {
  try {
    if (rejectCrossShopAccess(req.params.shopId, req, res)) {
      return;
    }

    if (!req.file) {
      return res.status(400).json({ message: "Logo file is required." });
    }

    const shop = await Shop.findByPk(req.shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    const isPlatformAdmin = req.user?.role === "admin";
    const isOwner = shop.ownerId === req.user?.id || req.shopMembershipRole === "OWNER";

    if (!isPlatformAdmin && !isOwner) {
      return res.status(403).json({ message: "Only the shop owner can update this shop identity." });
    }

    const logoPath = `/uploads/${req.file.filename}`;
    const mergedConfig = mergeShopConfig(shop.config || {});

    shop.config = {
      ...mergedConfig,
      branding: {
        ...mergedConfig.branding,
        logo: logoPath,
      },
    };

    await shop.save();

    return res.status(201).json({
      message: "Shop logo uploaded successfully.",
      logoUrl: logoPath,
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

const normalizeMemberRole = (value) => {
  const normalized = String(value || "STAFF").trim().toUpperCase();
  if (!["OWNER", "STAFF"].includes(normalized)) {
    return null;
  }
  return normalized;
};

const listMembers = async (req, res, next) => {
  try {
    if (rejectCrossShopAccess(req.params.shopId, req, res)) {
      return;
    }

    const members = await UserShop.findAll({
      where: { ShopId: req.shopId },
      include: [{ model: User, attributes: ["id", "name", "email", "role"] }],
      order: [[{ model: User, as: "User" }, "name", "ASC"]],
    });

    return res.json({
      members: members
        .filter((membership) => Boolean(membership.User))
        .map((membership) => ({
          id: membership.id,
          role: membership.role,
          createdAt: membership.createdAt,
          user: {
            id: membership.User.id,
            name: membership.User.name,
            email: membership.User.email,
            role: membership.User.role,
          },
        })),
    });
  } catch (error) {
    return next(error);
  }
};

const addMember = async (req, res, next) => {
  try {
    if (rejectCrossShopAccess(req.params.shopId, req, res)) {
      return;
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = normalizeMemberRole(req.body?.role);

    if (!email) {
      return res.status(400).json({ message: "Member email is required." });
    }

    if (!role) {
      return res.status(400).json({ message: "Role must be OWNER or STAFF." });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "No user account found with that email." });
    }

    const [membership, created] = await UserShop.findOrCreate({
      where: {
        UserId: user.id,
        ShopId: req.shopId,
      },
      defaults: {
        UserId: user.id,
        ShopId: req.shopId,
        role,
      },
    });

    if (!created && membership.role !== role) {
      membership.role = role;
      await membership.save();
    }

    return res.status(created ? 201 : 200).json({
      member: {
        id: membership.id,
        role: membership.role,
        createdAt: membership.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      message: created ? "Member added to shop." : "Member role updated.",
    });
  } catch (error) {
    return next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    if (rejectCrossShopAccess(req.params.shopId, req, res)) {
      return;
    }

    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

    const shop = await Shop.findByPk(req.shopId, {
      attributes: ["id", "ownerId"],
    });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    if (shop.ownerId === userId) {
      return res.status(400).json({ message: "Shop owner cannot be removed from membership." });
    }

    const removed = await UserShop.destroy({
      where: {
        ShopId: req.shopId,
        UserId: userId,
      },
      limit: 1,
    });

    if (!removed) {
      return res.status(404).json({ message: "Member not found for this shop." });
    }

    return res.json({ message: "Member removed from shop." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  create,
  listMine,
  updateName,
  uploadLogo,
  listMembers,
  addMember,
  removeMember,
};
