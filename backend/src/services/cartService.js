const { Product, ProductVariant } = require("../models");

const resolveActiveProductForCart = async ({ productId, variantId = null }) => {
  const product = await Product.findOne({
    where: {
      id: productId,
      status: "active",
    },
  });

  if (!product) {
    return { error: "Product not found or inactive." };
  }

  let variant = null;
  let itemPrice = product.price;
  let availableStock = product.stock;

  if (variantId) {
    variant = await ProductVariant.findOne({
      where: {
        id: variantId,
        ProductId: product.id,
        ShopId: product.ShopId,
      },
    });

    if (!variant) {
      return { error: "Variant not found for this product." };
    }

    itemPrice = variant.price ? variant.price : product.price;
    availableStock = variant.stock;
  }

  return {
    product,
    variant,
    itemPrice,
    availableStock,
    shopId: product.ShopId,
  };
};

module.exports = {
  resolveActiveProductForCart,
};