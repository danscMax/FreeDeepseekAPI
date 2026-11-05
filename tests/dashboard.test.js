const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

process.env.PROXY_API_KEY = 'dashboard-test-key';
const { server, accounts, loadProxyApiKey } = require('../server.js').__test;
let base;
let addedId;

test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  const added = accounts.find(a => a.id === addedId);
  if (added?.file) fs.unlinkSync(added.file);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test('legacy proxy key alias is accepted and the upstream key takes precedence', () => {
  assert.equal(loadProxyApiKey({ DEEPSEEK_API_KEY: 'legacy-fixture' }), 'legacy-fixture');
  assert.equal(loadProxyApiKey({ DEEPSEEK_API_KEY: 'legacy-fixture', PROXY_API_KEY: 'current-fixture' }), 'current-fixture');
});

test('dashboard shell is public while account APIs require authentication', async () => {
  const shell = await fetch(base + '/dashboard');
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /Add to FreeLLMAPI|addToLlm/);
  assert.equal((await fetch(base + '/api/accounts')).status, 401);
});

test('authenticated browser extension can import, label and delete a managed account', async () => {
  const headers = { Authorization: 'Bearer dashboard-test-key', Origin: 'chrome-extension://fixture', 'Content-Type': 'application/json' };
  const imported = await fetch(base + '/api/accounts/import', { method: 'POST', headers, body: JSON.stringify({ token: 'fixture-token', cookie: 'fixture=cookie' }) });
  assert.equal(imported.status, 200);
  addedId = (await imported.json()).id;
  const labelled = await fetch(base + `/api/accounts/${addedId}/label`, { method: 'POST', headers, body: JSON.stringify({ label: 'Fixture label' }) });
  assert.equal(labelled.status, 200);
  const listed = await (await fetch(base + '/api/accounts', { headers })).json();
  assert.equal(listed.accounts.find(a => a.id === addedId).label, 'Fixture label');
  assert.equal(JSON.stringify(listed).includes('fixture-token'), false);
  const removed = await fetch(base + `/api/accounts/${addedId}`, { method: 'DELETE', headers });
  assert.equal(removed.status, 200);
  addedId = null;
});

test('foreign browser origins remain rejected even with a valid API key', async () => {
  const response = await fetch(base + '/api/accounts', { headers: { Authorization: 'Bearer dashboard-test-key', Origin: 'https://foreign.invalid' } });
  assert.equal(response.status, 403);
});
