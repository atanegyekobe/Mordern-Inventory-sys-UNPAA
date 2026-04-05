const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "PaymentEvent",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      paymentReference: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      eventType: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "payment_events",
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["payment_reference", "event_type"],
        },
      ],
    }
  );
