const { UserShop } = require("../models");

module.exports = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Missing auth token." });
    }

    if (!req.shopId) {
      return res.status(400).json({ message: "Shop context is required." });
    }

    if (req.user.role === "admin") {
      req.shopRole = "OWNER";
      return next();
    }

    const membership =
      req.shopMembershipRole ||
      (await UserShop.findOne({
        where: {
          UserId: req.user.id,
          ShopId: req.shopId,
        },
      }))?.role || null;

    if (!membership || !["OWNER", "STAFF", "ADMIN"].includes(membership)) {
      return res.status(403).json({ message: "Insufficient permissions for this shop." });
    }

    req.shopRole = membership;
    return next();
  } catch (error) {
    return next(error);
  }
};
