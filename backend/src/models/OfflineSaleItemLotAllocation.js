const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OfflineSaleItemLotAllocation",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      OfflineSaleItemId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "offline_sale_items",
          key: "id",
        },
      },
      InventoryLotId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "inventory_lots",
          key: "id",
        },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      unitCostMinorAtAllocation: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "offline_sale_item_lot_allocations",
      underscored: true,
      indexes: [
        { fields: ["offline_sale_item_id"] },
        { fields: ["inventory_lot_id"] },
      ],
    }
  );
