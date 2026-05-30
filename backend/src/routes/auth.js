const express = require("express");
const { register, login, me, logout } = require("../controllers/authController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", auth, me);
router.post("/logout", logout);

module.exports = router;
