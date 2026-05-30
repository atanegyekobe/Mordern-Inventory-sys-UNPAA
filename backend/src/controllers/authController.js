const { registerUser, loginUser, sanitizeUser } = require("../services/authService");

const register = async (req, res, next) => {
  try {
    const { name, email, password, type, role, shopName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const payload = await registerUser({ name, email, password, type: type || role, shopName });

    // Set HTTP-only cookie. Use SameSite=None and Secure in production (for cross-site cookies),
    // but fall back to SameSite=Lax locally so browsers accept the cookie over HTTP during development.
    res.cookie("ellora_token", payload.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(201).json({
      user: payload.user,
      shops: payload.shops,
      activeShopId: payload.activeShopId,
      requiresShopSelection: payload.requiresShopSelection
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, activeShopId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials." });
    }

    const payload = await loginUser({ email, password, activeShopId });
    
    // Set HTTP-only cookie. Use SameSite=None and Secure in production.
    res.cookie("ellora_token", payload.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return res.json({
      user: payload.user,
      shops: payload.shops,
      activeShopId: payload.activeShopId,
      requiresShopSelection: payload.requiresShopSelection
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

const me = async (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
};

const logout = async (req, res) => {
  // Clear HTTP-only cookie
  res.clearCookie("ellora_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  return res.json({ message: "Logged out successfully." });
};

module.exports = {
  register,
  login,
  me,
  logout,
};
