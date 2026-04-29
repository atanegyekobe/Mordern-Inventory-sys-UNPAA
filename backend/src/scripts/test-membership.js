(async () => {
  const base = 'http://localhost:4000/api';
  const headersJSON = { 'Content-Type': 'application/json' };
  const run = async (name, opts) => {
    const res = await fetch(`${base}${opts.path}`, opts);
    const body = await res.text();
    try { return { status: res.status, body: JSON.parse(body) }; } catch (e) { return { status: res.status, body }; }
  };

  console.log('1) Register owner (business user)');
  const ownerEmail = `owner1+${Date.now()}@example.test`;
  const ownerResp = await run('ownerRegister', { method: 'POST', headers: headersJSON, body: JSON.stringify({ name: 'Owner One', email: ownerEmail, password: 'Pass1234!', type: 'business', shopName: 'TestShop' }), path: '/auth/register' });
  console.log('ownerResp status', ownerResp.status);
  console.log(ownerResp.body);
  const ownerToken = ownerResp.body?.token;
  const activeShopId = ownerResp.body?.activeShopId;
  if (!ownerToken) { console.error('Owner token missing - abort'); process.exit(1); }

  console.log('\n2) Register customer (to be member)');
  const custEmail = `cust1+${Date.now()}@example.test`;
  const custResp = await run('custRegister', { method: 'POST', headers: headersJSON, body: JSON.stringify({ name: 'Customer One', email: custEmail, password: 'Pass1234!' }), path: '/auth/register' });
  console.log('custResp status', custResp.status);
  console.log(custResp.body);
  const custId = custResp.body?.user?.id;
  if (!custId) { console.error('Customer id missing - abort'); process.exit(1); }

  console.log('\n3) Register non-member user');
  const otherEmail = `other1+${Date.now()}@example.test`;
  const otherResp = await run('otherRegister', { method: 'POST', headers: headersJSON, body: JSON.stringify({ name: 'Other User', email: otherEmail, password: 'Pass1234!' }), path: '/auth/register' });
  console.log('otherResp status', otherResp.status);
  console.log(otherResp.body);
  const otherId = otherResp.body?.user?.id;

  console.log('\n4) Owner adds customer as shop member');
  const addMemberResp = await run('addMember', { method: 'POST', headers: { ...headersJSON, Authorization: `Bearer ${ownerToken}` }, body: JSON.stringify({ email: custEmail, role: 'STAFF' }), path: `/shops/${activeShopId}/members` });
  console.log('addMember status', addMemberResp.status);
  console.log(addMemberResp.body);

  console.log('\n5) Owner requests /customers');
  const customersResp = await run('getCustomers', { method: 'GET', headers: { Authorization: `Bearer ${ownerToken}` }, path: '/customers' });
  console.log('customers status', customersResp.status);
  console.log(customersResp.body);

  console.log('\n6) Attempt to send admin message to non-member (should be rejected)');
  const sendResp = await run('sendAdminMsg', { method: 'POST', headers: { ...headersJSON, Authorization: `Bearer ${ownerToken}` }, body: JSON.stringify({ userId: otherId, subject: 'Test', content: 'Hello', priority: 'low' }), path: '/messages/admin/send' });
  console.log('sendAdmin status', sendResp.status);
  console.log(sendResp.body);

  process.exit(0);
})();
