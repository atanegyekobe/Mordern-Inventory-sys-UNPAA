const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Category",
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
      name: {
        type: DataTypes.STRING(140),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      ParentId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "categories",
      underscored: true,
    }
  );
