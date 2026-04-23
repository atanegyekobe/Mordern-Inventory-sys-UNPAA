const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "InventoryLot",
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
      lotCode: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      sourceType: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      sourceRefId: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      initialQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      remainingQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      unitCostMinor: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("open", "consumed", "void"),
        allowNull: false,
        defaultValue: "open",
      },
      note: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      CreatedByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      tableName: "inventory_lots",
      underscored: true,
      indexes: [
        { fields: ["shop_id", "product_id", "status"] },
        { fields: ["shop_id", "received_at"] },
      ],
    }
  );
