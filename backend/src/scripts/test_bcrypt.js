const bcrypt = require('bcrypt');
require('../config/env');
const { sequelize, User } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected\n');
    
    const admin = await User.findOne({ where: { email: 'admin@ellora.local' }, raw: true });
    
    if (!admin) {
      console.log('✗ Admin user not found');
      process.exit(1);
    }
    
    console.log('Admin user found:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.name}`);
    console.log(`  Password Hash: ${admin.password_hash ? admin.password_hash.substring(0, 30) + '...' : 'NULL'}`);
    console.log('');
    
    // Test password comparison
    const testPassword = 'change-me';
    console.log(`Testing password: "${testPassword}"`);
    
    if (!admin.password_hash) {
      console.log('✗ No password hash stored!');
      process.exit(1);
    }
    
    const matches = await bcrypt.compare(testPassword, admin.password_hash);
    console.log(`✓ bcrypt.compare result: ${matches}`);
    
    if (!matches) {
      console.log('\nPassword mismatch! The stored hash does not match the password.');
      console.log('The users may have been created with different passwords than expected.');
    } else {
      console.log('✓ Password matches!');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();
