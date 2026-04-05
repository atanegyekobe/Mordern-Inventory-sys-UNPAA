"use strict";

// Prevent deleting products with order history and categories with children
module.exports = {
  async up(queryInterface, Sequelize) {
    // Products: Prevent delete if referenced in OrderItems
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_product_delete_if_ordered()
      RETURNS trigger AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "OrderItems" WHERE "ProductId" = OLD.id) THEN
          RAISE EXCEPTION 'Cannot delete product with order history.';
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_product_delete ON "Products";
      CREATE TRIGGER trg_prevent_product_delete
      BEFORE DELETE ON "Products"
      FOR EACH ROW EXECUTE FUNCTION prevent_product_delete_if_ordered();
    `);

    // Categories: Prevent delete if has children
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_category_delete_if_has_children()
      RETURNS trigger AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "Categories" WHERE "parentId" = OLD.id) THEN
          RAISE EXCEPTION 'Cannot delete category with child categories.';
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_category_delete ON "Categories";
      CREATE TRIGGER trg_prevent_category_delete
      BEFORE DELETE ON "Categories"
      FOR EACH ROW EXECUTE FUNCTION prevent_category_delete_if_has_children();
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_product_delete ON "Products";
      DROP FUNCTION IF EXISTS prevent_product_delete_if_ordered();
    `);
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_prevent_category_delete ON "Categories";
      DROP FUNCTION IF EXISTS prevent_category_delete_if_has_children();
    `);
  }
};
