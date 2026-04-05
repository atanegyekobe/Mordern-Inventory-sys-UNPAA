"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. UNIQUE constraints
    await queryInterface.addConstraint("Products", {
      fields: ["slug"],
      type: "unique",
      name: "unique_products_slug"
    });
    await queryInterface.addConstraint("Products", {
      fields: ["sku"],
      type: "unique",
      name: "unique_products_sku"
    });
    await queryInterface.addConstraint("Payments", {
      fields: ["payment_reference"],
      type: "unique",
      name: "unique_payments_payment_reference"
    });

    // 2. FOREIGN KEYS
    await queryInterface.addConstraint("OrderItems", {
      fields: ["OrderId"],
      type: "foreign key",
      name: "fk_order_items_order_id",
      references: {
        table: "Orders",
        field: "id"
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });
    await queryInterface.addConstraint("OrderItems", {
      fields: ["ProductId"],
      type: "foreign key",
      name: "fk_order_items_product_id",
      references: {
        table: "Products",
        field: "id"
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE"
    });

    // 3. CHECK constraints
    await queryInterface.addConstraint("Products", {
      fields: ["price"],
      type: "check",
      name: "check_products_price_nonnegative",
      where: {
        price: { [Sequelize.Op.gte]: 0 }
      }
    });
    await queryInterface.addConstraint("Products", {
      fields: ["stock"],
      type: "check",
      name: "check_products_stock_nonnegative",
      where: {
        stock: { [Sequelize.Op.gte]: 0 }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove constraints in reverse order
    await queryInterface.removeConstraint("Products", "check_products_stock_nonnegative");
    await queryInterface.removeConstraint("Products", "check_products_price_nonnegative");
    await queryInterface.removeConstraint("OrderItems", "fk_order_items_product_id");
    await queryInterface.removeConstraint("OrderItems", "fk_order_items_order_id");
    await queryInterface.removeConstraint("Payments", "unique_payments_payment_reference");
    await queryInterface.removeConstraint("Products", "unique_products_sku");
    await queryInterface.removeConstraint("Products", "unique_products_slug");
  }
};
