const express = require("express");
const auth = require("../middleware/auth");
const { resolveShopContext } = require("../middleware/shopContext");
const { validateBody } = require("../middleware/zodValidate");
const { paymentInitializeSchema } = require("../validationSchemas");
const {
  initialize,
  verify,
  callback,
  webhook,
} = require("../controllers/paymentController");

const router = express.Router();

router.get("/callback", callback);
router.post("/webhook", webhook);
router.post("/initialize", auth, resolveShopContext, validateBody(paymentInitializeSchema), initialize);
router.get("/verify/:reference", auth, resolveShopContext, verify);

module.exports = router;
