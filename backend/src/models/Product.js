const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Product",
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
      name: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      priceMinor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Cost of goods/production",
      },
      costMinor: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      compareAtPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      compareAtPriceMinor: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      sku: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("active", "draft"),
        allowNull: false,
        defaultValue: "active",
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      tableName: "products",
      underscored: true,
    }
  );
