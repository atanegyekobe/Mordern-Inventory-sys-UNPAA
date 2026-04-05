const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Coupon",
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
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("percentage", "fixed"),
        allowNull: false,
        defaultValue: "percentage",
      },
      value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      minPurchase: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0,
      },
      maxDiscount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      usageLimit: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      usageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "expired"),
        allowNull: false,
        defaultValue: "active",
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "coupons",
      underscored: true,
    }
  );
