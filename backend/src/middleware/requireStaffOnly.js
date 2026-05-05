const { UserShop } = require("../models");

module.exports = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Missing auth token." });
    }

    if (!req.shopId) {
      return res.status(400).json({ message: "Shop context is required." });
    }

    // Admins (global) cannot use staff features like stock requests
    if (req.user.role === "admin") {
      return res.status(403).json({ 
        message: "Admins have direct stock access and do not need to request stock." 
      });
    }

    const membership =
      req.shopMembershipRole ||
      (await UserShop.findOne({
        where: {
          UserId: req.user.id,
          ShopId: req.shopId,
        },
      }))?.role || null;

    if (!membership || !["STAFF"].includes(membership)) {
      return res.status(403).json({ message: "Only shop staff can create stock requests." });
    }

    req.shopRole = membership;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};
