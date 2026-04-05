const express = require("express");
const auth = require("../middleware/auth");
const { create, listMine } = require("../controllers/shopController");

const router = express.Router();

router.get("/mine", auth, listMine);
router.post("/", auth, create);

module.exports = router;