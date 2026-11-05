const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extension(tabAvailable) {
  let listener;
  let capture;
  let stored = { token: 'captured-fixture', cookie: 'captured=1' };
  const chrome = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    webRequest: { onBeforeSendHeaders: { addListener(fn) { capture = fn; } } },
    tabs: {
      query(_query, cb) { cb(tabAvailable ? [{ id: 1 }] : []); },
      sendMessage(_id, _request, cb) { cb({ data: { userToken: JSON.stringify({ value: 'current-fixture' }), hif_leim: 'hif-fixture' } }); },
    },
    cookies: { getAll(_query, cb) { cb([{ domain: '.deepseek.com', name: 'session', value: 'fixture' }, { domain: 'unrelated.invalid', name: 'foreign', value: 'excluded' }]); } },
    storage: { local: {
      set(value, cb) { stored = value.deepseek_capture; cb?.(); },
      get(_key, cb) { cb({ deepseek_capture: stored }); },
    } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../chrome-extension/background.js'), 'utf8'), { chrome, Date });
  return { request: () => new Promise(resolve => listener({ action: 'get' }, {}, resolve)), capture };
}

test('extension collects the current login and excludes foreign cookies', async () => {
  const result = await extension(true).request();
  assert.equal(result.cap.token, 'current-fixture');
  assert.equal(result.cap.cookie, 'session=fixture');
  assert.equal(result.cap.hif_leim, 'hif-fixture');
});

test('extension retains captured-request fallback when no tab is open', async () => {
  const result = await extension(false).request();
  assert.equal(result.cap.token, 'captured-fixture');
});

test('extension still captures real Authorization, Cookie and optional hif headers', async () => {
  const background = extension(false);
  background.capture({ requestHeaders: [{ name: 'Authorization', value: 'Bearer request-fixture' }, { name: 'Cookie', value: 'session=request-fixture' }, { name: 'x-hif-dliq', value: 'request-hif' }] });
  const result = await background.request();
  assert.equal(result.cap.token, 'request-fixture');
  assert.equal(result.cap.hif_dliq, 'request-hif');
});
