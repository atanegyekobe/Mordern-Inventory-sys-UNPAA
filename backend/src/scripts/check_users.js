require('../config/env');
const { sequelize, User } = require('../models');
const bcrypt = require('bcrypt');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');
    
    const users = await User.findAll({ attributes: ['id', 'name', 'email', 'passwordHash', 'role'] });
    console.log(`\n Found ${users.length} users:\n`);
    
    users.forEach(u => {
      console.log(`Email: ${u.email}`);
      console.log(`  Name: ${u.name}`);
      console.log(`  Role: ${u.role}`);
      console.log(`  Password Hash Present: ${u.passwordHash ? 'YES' : 'NO'}`);
      if (u.passwordHash) {
        console.log(`  Hash Preview: ${u.passwordHash.substring(0, 20)}...`);
      }
      console.log('');
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();
