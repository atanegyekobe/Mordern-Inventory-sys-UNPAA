const express = require("express");
const auth = require("../middleware/auth");
const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  checkout,
} = require("../controllers/cartController");

const router = express.Router();

router.get("/", auth, getCart);
router.post("/items", auth, addItem);
router.patch("/items/:id", auth, updateItem);
router.delete("/items/:id", auth, removeItem);
router.post("/checkout", auth, checkout);

module.exports = router;
