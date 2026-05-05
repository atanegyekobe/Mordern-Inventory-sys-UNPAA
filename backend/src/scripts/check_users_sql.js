const { Client } = require('pg');
require('../config/env');
const config = require('../config/env');

const client = new Client({
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  user: config.dbUser,
  password: config.dbPassword,
});

(async () => {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');
    
    const result = await client.query('SELECT id, name, email, password_hash, role FROM users;');
    
    console.log(`Found ${result.rows.length} users:\n`);
    
    result.rows.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Password Hash Present: ${user.password_hash ? 'YES' : 'NO'}`);
      if (user.password_hash) {
        console.log(`  Hash Start: ${user.password_hash.substring(0, 15)}...`);
      }
      console.log('');
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
