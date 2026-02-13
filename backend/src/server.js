const app = require("./app");
const { sequelize } = require("./models");
const config = require("./config/env");

const startServer = async () => {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log("Database connection established.");

    app.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`API running on port ${config.port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

startServer();
