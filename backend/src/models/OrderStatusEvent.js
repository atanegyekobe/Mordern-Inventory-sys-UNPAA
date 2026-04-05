const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OrderStatusEvent",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      fromStatus: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      toStatus: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      actorRole: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "system",
      },
      actorUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: "order_status_events",
      underscored: true,
    }
  );
