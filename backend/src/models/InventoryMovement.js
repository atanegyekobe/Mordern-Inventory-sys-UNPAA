const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "InventoryMovement",
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
      ProductId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "products",
          key: "id",
        },
      },
      ProductVariantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "product_variants",
          key: "id",
        },
      },
      movementType: {
        type: DataTypes.ENUM("IN", "OUT", "ADJUSTMENT"),
        allowNull: false,
      },
      changeQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quantityAfter: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      referenceType: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      referenceId: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      CreatedByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "inventory_movements",
      underscored: true,
      indexes: [
        { fields: ["shop_id", "created_at"] },
        { fields: ["product_id", "created_at"] },
        { fields: ["movement_type"] },
      ],
    }
  );
