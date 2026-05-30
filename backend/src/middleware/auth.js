const jwt = require("jsonwebtoken");
const config = require("../config/env");
const { User } = require("../models");

const getTokenFromRequest = (req) => {
  // Try Authorization header first (for backward compatibility)
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  // Try HTTP-only cookie (primary method for production)
  if (req.cookies?.ellora_token) {
    return req.cookies.ellora_token;
  }
  
  return null;
};

module.exports = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: "Missing auth token." });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findByPk(decoded.sub, {
      attributes: { exclude: ["passwordHash"] },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid auth token." });
    }

    user.activeShopId = decoded.activeShopId || null;
    req.auth = {
      activeShopId: decoded.activeShopId || null,
    };
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid auth token." });
  }
};
