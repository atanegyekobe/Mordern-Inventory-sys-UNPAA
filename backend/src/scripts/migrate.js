require("../config/env");

const { sequelize } = require("../models");

async function runMigrations() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("Database migration completed for active models.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
