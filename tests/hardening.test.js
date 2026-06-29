const test = require('node:test');
const assert = require('node:assert/strict');

const S = require('../server.js').__test;
const { decodeTokenInfo } = require('../lib/jwt');
const { finalizeAuth, isAllowedWasmUrl, WASM_DEFAULT } = require('../lib/parseAuth');
const pow = require('../lib/pow');

// --- resetSession clears DeepSeek-side state, keeps history ---
test('resetSession nulls session/id state and zeroes messageCount', () => {
  const s = S.createSession();
  s.id = 'sess'; s.parentMessageId = 'm1'; s.createdAt = 123; s.messageCount = 7;
  s.history.push({ user: 'u', assistant: 'a' });
  S.resetSession(s);
  assert.equal(s.id, null);
  assert.equal(s.parentMessageId, null);
  assert.equal(s.createdAt, null);
  assert.equal(s.messageCount, 0);
  assert.equal(s.history.length, 1, 'history is preserved across reset');
});

// --- buildTextResponse surfaces truncation via finish_reason ---
test('buildTextResponse maps finishReason length->length, else stop', () => {
  assert.equal(S.buildTextResponse('hi', 'p', 'deepseek-chat', '', 'length').choices[0].finish_reason, 'length');
  assert.equal(S.buildTextResponse('hi', 'p', 'deepseek-chat', '', 'stop').choices[0].finish_reason, 'stop');
  assert.equal(S.buildTextResponse('hi', 'p', 'deepseek-chat', '', null).choices[0].finish_reason, 'stop');
});

// --- estimateTokens / buildUsage ---
test('estimateTokens is ceil(len/4) and 0 for empty', () => {
  assert.equal(S.estimateTokens(''), 0);
  assert.equal(S.estimateTokens('abcd'), 1);
  assert.equal(S.estimateTokens('abcde'), 2);
});

// --- parseRetryAfterMs: seconds, junk, http-date ---
test('parseRetryAfterMs parses seconds and rejects junk', () => {
  assert.equal(S.parseRetryAfterMs('120'), 120000);
  assert.equal(S.parseRetryAfterMs('0'), 1000, 'clamped to >=1s');
  assert.equal(S.parseRetryAfterMs('abc'), null);
  assert.equal(S.parseRetryAfterMs(''), null);
  assert.equal(S.parseRetryAfterMs(null), null);
});

// --- CORS allowlist: same-origin echoed, foreign rejected ---
test('corsOriginFor echoes same-origin only, rejects foreign', () => {
  const same = { headers: { origin: 'http://localhost:9655', host: 'localhost:9655' } };
  const foreign = { headers: { origin: 'http://evil.example', host: 'localhost:9655' } };
  const none = { headers: { host: 'localhost:9655' } };
  assert.equal(S.corsOriginFor(same), 'http://localhost:9655');
  assert.equal(S.corsOriginFor(foreign), null);
  assert.equal(S.corsOriginFor(none), null);
});

// --- isAuthorized open when no API key configured (back-compat default) ---
test('isAuthorized passes when DEEPSEEK_API_KEY is unset', () => {
  assert.equal(S.isAuthorized({ headers: {} }), true);
});

// --- sweepIdleSessions drops stale, keeps fresh ---
test('sweepIdleSessions evicts only idle entries', () => {
  S.sessions.set('stale-x', { lastActivityAt: 1 });
  S.sessions.set('fresh-x', { lastActivityAt: Date.now() });
  S.sweepIdleSessions(60 * 1000);
  assert.equal(S.sessions.has('stale-x'), false);
  assert.equal(S.sessions.has('fresh-x'), true);
  S.sessions.delete('fresh-x');
});

// --- JWT exp decode (display only) ---
test('decodeTokenInfo reads exp and tolerates junk', () => {
  const payload = Buffer.from(JSON.stringify({ exp: 1700000000 })).toString('base64url');
  const tok = `h.${payload}.sig`;
  assert.equal(decodeTokenInfo(tok).exp, 1700000000 * 1000);
  assert.equal(decodeTokenInfo('not-a-jwt').exp, null);
  assert.equal(decodeTokenInfo('').exp, null);
});

// --- wasmUrl SSRF allowlist ---
test('isAllowedWasmUrl accepts deepseek https .wasm only', () => {
  assert.equal(isAllowedWasmUrl('https://fe-static.deepseek.com/chat/static/x.wasm'), true);
  assert.equal(isAllowedWasmUrl('http://fe-static.deepseek.com/x.wasm'), false, 'http rejected');
  assert.equal(isAllowedWasmUrl('https://evil.example/x.wasm'), false, 'foreign host rejected');
  assert.equal(isAllowedWasmUrl('https://fe-static.deepseek.com/x.js'), false, 'non-wasm rejected');
  assert.equal(isAllowedWasmUrl('https://169.254.169.254/x.wasm'), false, 'metadata IP rejected');
  assert.equal(isAllowedWasmUrl(''), false);
});

test('finalizeAuth ignores a disallowed wasmUrl and falls back to default', () => {
  const r = finalizeAuth({ token: 't', cookie: 'c', wasmUrl: 'http://169.254.169.254/x.wasm' }, undefined);
  assert.equal(r.wasmUrl, WASM_DEFAULT);
  const ok = finalizeAuth({ token: 't', cookie: 'c', wasmUrl: 'https://fe-static.deepseek.com/a.wasm' }, undefined);
  assert.equal(ok.wasmUrl, 'https://fe-static.deepseek.com/a.wasm');
});

// --- pow module exposes a compile cache ---
test('lib/pow exposes a module cache Map', () => {
  assert.ok(pow._moduleCache instanceof Map);
});
