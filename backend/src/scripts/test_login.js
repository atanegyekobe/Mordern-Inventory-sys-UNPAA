require('../config/env');
const config = require('../config/env');
const fetch = global.fetch || require('node-fetch');

(async () => {
  const testCases = [
    { email: 'admin@ellora.local', password: 'change-me', description: 'Admin account' },
    { email: 'user001@elora.system', password: 'test', description: 'Test user 001' },
    { email: 'user100@ellora.local', password: 'test', description: 'Test user 100' },
  ];

  for (const test of testCases) {
    try {
      const res = await fetch(`http://localhost:${config.port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: test.email, password: test.password }),
      });

      const data = await res.text();
      console.log(`\n✓ ${test.description}`);
      console.log(`  Email: ${test.email}`);
      console.log(`  Password: ${test.password}`);
      console.log(`  Status: ${res.status}`);
      console.log(`  Response: ${data.substring(0, 150)}`);
    } catch (err) {
      console.error(`\n✗ ${test.description}: ${err.message}`);
    }
  }
  process.exit(0);
})();
