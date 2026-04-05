const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "ProductVariant",
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
      attributes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        comment: "JSON object with size, color, etc. e.g., { size: M, color: red }",
      },
      sku: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "If null, uses parent product price",
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "Variant-specific image URL",
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      tableName: "product_variants",
      underscored: true,
    }
  );
