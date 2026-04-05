const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Message",
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
      subject: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("open", "replied", "closed"),
        allowNull: false,
        defaultValue: "open",
      },
      priority: {
        type: DataTypes.ENUM("low", "medium", "high"),
        allowNull: false,
        defaultValue: "medium",
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      tableName: "messages",
      underscored: true,
    }
  );
