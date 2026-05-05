const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "StockRequest",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      ShopId: {
        type: DataTypes.UUID,
        field: "shop_id",
        allowNull: false,
        references: {
          model: "shops",
          key: "id",
        },
      },
      ProductId: {
        type: DataTypes.UUID,
        field: "product_id",
        allowNull: false,
        references: {
          model: "products",
          key: "id",
        },
      },
      UserId: {
        type: DataTypes.UUID,
        field: "user_id",
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      RequesterId: {
        type: DataTypes.UUID,
        field: "requester_id",
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      reason: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      approvedBy: {
        type: DataTypes.UUID,
        field: "approved_by",
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      rejectionReason: {
        type: DataTypes.STRING(500),
        field: "rejection_reason",
        allowNull: true,
      },
      approvedAt: {
        type: DataTypes.DATE,
        field: "approved_at",
        allowNull: true,
      },
    },
    {
      tableName: "stock_requests",
      underscored: true,
    }
  );
