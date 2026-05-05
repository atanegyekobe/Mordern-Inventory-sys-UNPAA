const { Client } = require('pg');
require('../config/env');
const config = require('../config/env');

(async () => {
  const client = new Client({
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
  });

  try {
    await client.connect();
    await client.query('DELETE FROM users WHERE email = $1', ['admin@ellora.local']);
    console.log('Admin user deleted');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
