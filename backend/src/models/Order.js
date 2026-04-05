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
      ShopId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "shops",
          key: "id",
        },
      },
      status: {
        type: DataTypes.ENUM(
          "pending_payment",
          "packed",
          "shipped",
          "out_for_delivery",
          "delivered",
          "received",
          "delivery_failed",
          "returned",
          "refunded",
          "fraud_hold",
          "pending",
          "paid",
          "processing",
          "delivery_pickup",
          "fulfilled",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "pending_payment",
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      totalMinor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalPaid: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      balanceDue: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: "GHS",
      },
      shippingAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      billingAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: "Additional order metadata including automation overrides",
      },
    },
    {
      tableName: "orders",
      underscored: true,
    }
  );
