const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "CartItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      ShopId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "shops",
          key: "id",
        },
      },
      ProductId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "products",
          key: "id",
        },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      VariantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "product_variants",
          key: "id",
        },
      },
    },
    {
      tableName: "cart_items",
      underscored: true,
      hooks: {
        beforeValidate: async (item) => {
          if (!item.ProductId || !item.ShopId) {
            return;
          }

          const Product = sequelize.models.Product;
          const product = await Product.findByPk(item.ProductId);
          if (!product) {
            throw new Error("Invalid product for cart item.");
          }

          if (product.ShopId !== item.ShopId) {
            throw new Error("Cart item shop_id must match product.shop_id.");
          }
        },
      },
    }
  );
