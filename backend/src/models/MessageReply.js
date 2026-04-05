const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "MessageReply",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isAdminReply: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "message_replies",
      underscored: true,
    }
  );
