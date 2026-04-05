const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Shop",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true,
      },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "owner_id",
        references: {
          model: "users",
          key: "id",
        },
      },
      config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "shops",
      underscored: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );