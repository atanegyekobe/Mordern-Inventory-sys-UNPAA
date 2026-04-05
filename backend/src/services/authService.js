const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const { sequelize, User, Shop, UserShop } = require("../models");
const { createShopForUser } = require("./shopService");

const CUSTOMER_SIGNUP_ROLE = "customer";
const BUSINESS_SIGNUP_ROLE = "business";

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const signToken = (user, activeShopId = null) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
      activeShopId: activeShopId || null,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
    }
  );

const normalizeSignupRole = (role) => {
  const normalized = String(role || CUSTOMER_SIGNUP_ROLE)
    .trim()
    .toLowerCase();

  if (normalized !== CUSTOMER_SIGNUP_ROLE && normalized !== BUSINESS_SIGNUP_ROLE) {
    return null;
  }

  return normalized;
};

const getUserShopContexts = async (userId) => {
  const memberships = await UserShop.findAll({
    where: { UserId: userId },
    include: [
      {
        model: Shop,
        attributes: ["id", "name", "slug", "ownerId", "config"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  return memberships
    .filter((membership) => Boolean(membership.Shop))
    .map((membership) => ({
      id: membership.Shop.id,
      name: membership.Shop.name,
      slug: membership.Shop.slug,
      ownerId: membership.Shop.ownerId,
      role: membership.role,
      config: membership.Shop.config || {},
    }));
};

const resolveActiveShopId = (requestedActiveShopId, shops) => {
  if (!Array.isArray(shops) || shops.length === 0) {
    return null;
  }

  if (requestedActiveShopId) {
    const hasRequested = shops.some((shop) => shop.id === requestedActiveShopId);
    if (!hasRequested) {
      return null;
    }
    return requestedActiveShopId;
  }

  if (shops.length === 1) {
    return shops[0].id;
  }

  return null;
};

const registerUser = async ({ name, email, password, type, role, shopName }) => {
  const signupRole = normalizeSignupRole(type || role);
  if (!signupRole) {
    throw new Error("Invalid signup role. Use customer or business.");
  }

  if (signupRole === BUSINESS_SIGNUP_ROLE && !String(shopName || "").trim()) {
    const error = new Error("shopName is required when role is business.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    const error = new Error("Email already in use.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.create(
      {
        name,
        email,
        passwordHash,
        role: "customer",
      },
      { transaction }
    );

    if (signupRole === BUSINESS_SIGNUP_ROLE) {
      await createShopForUser({
        ownerId: user.id,
        name: String(shopName).trim(),
        transaction,
      });
    }

    return user;
  });

  const shops = await getUserShopContexts(result.id);
  const activeShopId = resolveActiveShopId(null, shops);

  return {
    token: signToken(result, activeShopId),
    user: sanitizeUser(result),
    shops,
    activeShopId,
    requiresShopSelection: shops.length > 1 && !activeShopId,
  };
};

const loginUser = async ({ email, password, activeShopId }) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const error = new Error("Invalid credentials.");
    error.statusCode = 401;
    throw error;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    const error = new Error("Invalid credentials.");
    error.statusCode = 401;
    throw error;
  }

  const shops = await getUserShopContexts(user.id);

  const requestedShopId = activeShopId ? String(activeShopId).trim() : null;
  const resolvedActiveShopId = resolveActiveShopId(requestedShopId, shops);

  if (requestedShopId && !resolvedActiveShopId) {
    const error = new Error("Requested active shop is invalid.");
    error.statusCode = 403;
    throw error;
  }

  return {
    token: signToken(user, resolvedActiveShopId),
    user: sanitizeUser(user),
    shops,
    activeShopId: resolvedActiveShopId,
    requiresShopSelection: shops.length > 1 && !resolvedActiveShopId,
  };
};

module.exports = {
  registerUser,
  loginUser,
  sanitizeUser,
};