const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Order",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "paid", "fulfilled", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: "USD",
      },
      shippingAddress: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      billingAddress: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: "orders",
      underscored: true,
    }
  );
