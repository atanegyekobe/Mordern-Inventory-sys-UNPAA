const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      paymentReference: {
        type: DataTypes.STRING(200),
        allowNull: false,
        unique: true,
      },
      provider: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "paystack",
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "initialized",
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: true,
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "payments",
      underscored: true,
    }
  );
