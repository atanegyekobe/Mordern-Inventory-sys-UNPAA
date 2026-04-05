const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "CategoryVariantTemplate",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      CategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "categories",
          key: "id",
        },
      },
      attributeDefinitions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: `Array of attribute definitions:
        [
          {
            name: "size",
            label: "Size",
            required: true,
            type: "select",
            options: ["XS", "S", "M", "L", "XL"]
          },
          {
            name: "color",
            label: "Color",
            required: true,
            type: "text"
          },
          {
            name: "material",
            label: "Material",
            required: false,
            type: "text"
          }
        ]`,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Guide for admins on how to use this template",
      },
    },
    {
      tableName: "category_variant_templates",
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["category_id"],
        },
      ],
    }
  );
