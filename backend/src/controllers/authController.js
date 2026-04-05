const { registerUser, loginUser, sanitizeUser } = require("../services/authService");

const register = async (req, res, next) => {
  try {
    const { name, email, password, type, role, shopName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const payload = await registerUser({ name, email, password, type: type || role, shopName });

    return res.status(201).json(payload);
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
    return res.json(payload);
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

module.exports = {
  register,
  login,
  me,
};
