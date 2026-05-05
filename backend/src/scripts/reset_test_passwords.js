require('../config/env');
const bcrypt = require('bcrypt');
const { sequelize, User } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected\n');
    
    const testUsers = [
      'user001@elora.system',
      'user100@ellora.local',
      'user002@ellora.local',
      'user1001@ellora.local',
      'user002@elora.local',
      'shop1@elora.local',
      'elly1@elora.local',
      'elly2@elora.local',
      'elly3@elora.local',
      'flip@elora.com',
    ];
    
    const defaultPassword = 'test';
    const hash = await bcrypt.hash(defaultPassword, 10);
    
    for (const email of testUsers) {
      const user = await User.findOne({ where: { email } });
      if (user) {
        await user.update({ passwordHash: hash });
        console.log(`✓ Reset password for ${email}`);
      }
    }
    
    console.log(`\n✓ All test users can now login with password: "${defaultPassword}"`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();
