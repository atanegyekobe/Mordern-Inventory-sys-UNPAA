"use strict";

// Prevent deleting categories with child categories
module.exports = {
  async up(queryInterface, Sequelize) {
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
      DROP TRIGGER IF EXISTS trg_prevent_category_delete ON "Categories";
      DROP FUNCTION IF EXISTS prevent_category_delete_if_has_children();
    `);
  }
};
