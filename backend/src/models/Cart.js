const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Cart",
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
        type: DataTypes.ENUM("open", "converted"),
        allowNull: false,
        defaultValue: "open",
      },
    },
    {
      tableName: "carts",
      underscored: true,
    }
  );
