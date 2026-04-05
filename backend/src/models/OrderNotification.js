const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OrderNotification",
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
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      tableName: "order_notifications",
      underscored: true,
    }
  );
