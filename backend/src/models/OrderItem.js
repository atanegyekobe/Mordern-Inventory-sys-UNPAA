const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OrderItem",
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
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unitPriceMinor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      priceAtPurchase: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      costAtPurchase: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "order_items",
      underscored: true,
    }
  );
