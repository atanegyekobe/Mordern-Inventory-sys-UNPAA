const { getShopConfig } = require("../services/shopService");

const loadShopConfig = async (req, res, next) => {
  try {
    req.shopConfig = await getShopConfig(req.shopId);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = loadShopConfig;
