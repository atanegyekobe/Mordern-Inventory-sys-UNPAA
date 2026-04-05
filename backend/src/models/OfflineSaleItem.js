const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "OfflineSaleItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      OfflineSaleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "offline_sales",
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
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      priceAtSale: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "offline_sale_items",
      underscored: true,
    }
  );
