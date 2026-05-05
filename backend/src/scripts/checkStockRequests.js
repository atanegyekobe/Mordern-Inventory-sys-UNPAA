require("../config/env");

const { sequelize, StockRequest } = require("../models");

async function check() {
  try {
    await sequelize.authenticate();
    const count = await StockRequest.count();
    console.log("StockRequest table exists. Row count:", count);
    process.exit(0);
  } catch (err) {
    console.error("Error checking StockRequest table:", err.message || err);
    process.exit(1);
  }
}

check();
