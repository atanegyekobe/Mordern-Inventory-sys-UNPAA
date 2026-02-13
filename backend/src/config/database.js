const { Sequelize } = require("sequelize");
const config = require("./env");

const baseOptions = {
  dialect: "postgres",
  logging: false,
};

const sslOptions = config.dbSsl
  ? {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    }
  : {};

const sequelize = config.databaseUrl
  ? new Sequelize(config.databaseUrl, {
      ...baseOptions,
      ...sslOptions,
    })
  : new Sequelize(config.dbName, config.dbUser, config.dbPassword, {
      host: config.dbHost,
      port: config.dbPort,
      ...baseOptions,
      ...sslOptions,
    });

module.exports = sequelize;
