const { InventoryMovement } = require("../models");

const MOVEMENT_TYPES = {
  IN: "IN",
  OUT: "OUT",
  ADJUSTMENT: "ADJUSTMENT",
};

const normalizeOptionalText = (value, maxLength) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
};

const logInventoryMovement = async ({
  shopId,
  productId,
  productVariantId = null,
  movementType,
  changeQty,
  quantityAfter,
  reason,
  referenceType = null,
  referenceId = null,
  note = null,
  createdByUserId = null,
  metadata = {},
  transaction,
}) => {
  if (!shopId || !productId) {
    throw new Error("shopId and productId are required to log inventory movement.");
  }

  if (!Object.values(MOVEMENT_TYPES).includes(movementType)) {
    throw new Error("Invalid movementType for inventory movement.");
  }

  if (!Number.isInteger(changeQty) || changeQty === 0) {
    throw new Error("changeQty must be a non-zero integer.");
  }

  if (!Number.isInteger(quantityAfter) || quantityAfter < 0) {
    throw new Error("quantityAfter must be a non-negative integer.");
  }

  const movement = await InventoryMovement.create(
    {
      ShopId: shopId,
      ProductId: productId,
      ProductVariantId: productVariantId,
      movementType,
      changeQty,
      quantityAfter,
      reason: normalizeOptionalText(reason, 60) || "UNKNOWN",
      referenceType: normalizeOptionalText(referenceType, 60),
      referenceId: normalizeOptionalText(referenceId, 120),
      note: normalizeOptionalText(note, 255),
      CreatedByUserId: createdByUserId || null,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    },
    { transaction }
  );

  return movement;
};

module.exports = {
  MOVEMENT_TYPES,
  logInventoryMovement,
};
