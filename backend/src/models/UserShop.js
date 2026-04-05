const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "UserShop",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      role: {
        type: DataTypes.ENUM("OWNER", "STAFF"),
        allowNull: false,
        defaultValue: "STAFF",
      },
    },
    {
      tableName: "user_shops",
      underscored: true,
    }
  );