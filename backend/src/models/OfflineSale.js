const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OfflineSale",
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
      UserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      totalAmount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("COMPLETED", "CANCELLED"),
        allowNull: false,
        defaultValue: "COMPLETED",
      },
    },
    {
      tableName: "offline_sales",
      underscored: true,
    }
  );
