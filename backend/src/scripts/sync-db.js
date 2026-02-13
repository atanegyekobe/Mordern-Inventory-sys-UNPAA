require("../config/env");
const { sequelize } = require("../models");

const run = async () => {
  try {
    await sequelize.sync({ alter: true });
    // eslint-disable-next-line no-console
    console.log("Database synced.");
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Sync failed", error);
    process.exit(1);
  }
};

run();
