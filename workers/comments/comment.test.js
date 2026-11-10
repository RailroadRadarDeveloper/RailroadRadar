import assert from 'node:assert/strict';
import { test, before, beforeEach } from 'node:test';
import {
  handleRequest, resetCommentCaches, commentIdentity, parseGuardVerdict, parseProfanity,
  serviceAccountCredentials
} from './index.js';

const THREAD = 'mbta_fitchburg-line_412_2026-11-10';
const NOW = Date.parse('2026-11-10T21:00:00.000Z');
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let signKey;
let jwk;
let saJson;

function b64url(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pem(bytes) {
  const raw = btoa(String.fromCharCode(...bytes));
  const lines = raw.match(/.{1,64}/g).join('\n');
  return '-----BEGIN PRIVATE KEY-----\n' + lines + '\n-----END PRIVATE KEY-----\n';
}

async function signToken(payload, kid = 'kid-1') {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })));
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signKey.privateKey, new TextEncoder().encode(header + '.' + body));
  return header + '.' + body + '.' + b64url(sig);
}

function tokenPayload(extra) {
  return Object.assign({
    iss: 'https://securetoken.google.com/railroadradar-accounts',
    aud: 'railroadradar-accounts',
    sub: 'bob',
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000),
    email: 'Bob@Example.com',
    email_verified: true,
    name: 'Maya Chen',
    picture: 'https://lh3.googleusercontent.com/a/photo'
  }, extra);
}

function mockAI(state) {
  const calls = [];
  return {
    calls: calls,
    run: async function(model, input) {
      calls.push({ model: model, input: input });
      if (state && state.throw) throw new Error('ai down');
      if (String(model).indexOf('llama-guard') !== -1) {
        return { response: state && state.guard != null ? state.guard : 'safe' };
      }
      return { response: state && state.profanity != null ? state.profanity : '{"profanity":false}' };
    }
  };
}

function jsonRes(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function docs(state) {
  return function(url) {
    const u = String(url);
    if (u.includes('/trainCommentRate/')) return state.rate ? jsonRes(200, state.rate) : jsonRes(404, {});
    if (u.includes('/bannedUsers/')) return state.bannedUser ? jsonRes(200, { fields: {} }) : jsonRes(404, {});
    if (u.includes('/bannedEmails/')) return state.bannedEmail ? jsonRes(200, { fields: {} }) : jsonRes(404, {});
    if (u.includes('/userSettings/')) return state.settings ? jsonRes(200, state.settings) : jsonRes(404, {});
    if (u.includes('/verifiedReporters/')) return state.verified ? jsonRes(200, { fields: {} }) : jsonRes(404, {});
    return jsonRes(500, {});
  };
}

before(async () => {
  signKey = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  jwk = await crypto.subtle.exportKey('jwk', signKey.publicKey);
  jwk.kid = 'kid-1';
  jwk.alg = 'RS256';
  const sa = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', sa.privateKey));
  saJson = JSON.stringify({
    client_email: 'comments@railroadradar-accounts.iam.gserviceaccount.com',
    private_key: pem(pkcs8)
  });
});

beforeEach(() => resetCommentCaches());

function env(fetchImpl, extra) {
  const out = {
    FIREBASE_SA_JSON: saJson,
    AI: fetchImpl.ai,
    GUARD_MODEL: '@cf/meta/llama-guard-3-8b',
    PROFANITY_MODEL: '@cf/meta/llama-3.1-8b-instruct-fast',
    PROJECT_ID: 'railroadradar-accounts',
    now: function() { return NOW; },
    fetch: fetchImpl
  };
  if (extra) Object.assign(out, extra);
  return out;
}

async function call(fetchImpl, token, body, origin, envExtra) {
  const request = new Request('https://railroadradar-comments.railroadradar.workers.dev/comment', {
    method: 'POST',
    headers: {
      origin: origin || 'https://railroadradar.com',
      authorization: token ? 'Bearer ' + token : '',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body == null ? { threadId: THREAD, text: 'Nice ride' } : body)
  });
  const res = await handleRequest(request, env(fetchImpl, envExtra), fetchImpl);
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, cors: res.headers.get('access-control-allow-origin') };
}

function router(state) {
  const calls = [];
  const fetcher = async function(url, init) {
    const u = String(url);
    calls.push({ url: u, init: init || {} });
    if (u === JWKS) return jsonRes(200, { keys: [jwk] });
    if (u.startsWith('https://oauth2.googleapis.com/token')) return jsonRes(200, { access_token: 'ya29.test', expires_in: 3600 });
    if (u.includes('/documents:commit')) return jsonRes(state.commitStatus || 200, {});
    if (u.includes('/documents/')) return docs(state)(u);
    return jsonRes(500, {});
  };
  fetcher.calls = calls;
  fetcher.ai = mockAI(state);
  return fetcher;
}

function commitBody(fetcher) {
  const hit = fetcher.calls.find(function(c) { return c.url.includes('/documents:commit'); });
  assert.ok(hit, 'expected a Firestore commit');
  return JSON.parse(hit.init.body);
}

test('a clean comment is stored with the public fields and a 24h expiry', async () => {
  const fetcher = router({});
  const token = await signToken(tokenPayload());
  const res = await call(fetcher, token);
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.cors, 'https://railroadradar.com');
  const guard = fetcher.ai.calls[0];
  assert.equal(guard.model, '@cf/meta/llama-guard-3-8b');
  assert.deepEqual(guard.input.messages, [{ role: 'user', content: 'Nice ride' }]);
  assert.equal(fetcher.ai.calls[1].model, '@cf/meta/llama-3.1-8b-instruct-fast');
  assert.equal(fetcher.ai.calls[1].input.messages[1].content, 'Nice ride');
  const writes = commitBody(fetcher).writes;
  assert.equal(writes.length, 2);
  const fields = writes[0].update.fields;
  assert.equal(fields.uid.stringValue, 'bob');
  assert.equal(fields.text.stringValue, 'Nice ride');
  assert.equal(fields.displayName.stringValue, 'Maya C.');
  assert.equal(fields.anonymous.booleanValue, false);
  assert.equal(fields.photoURL.stringValue, 'https://lh3.googleusercontent.com/a/photo');
  assert.equal(fields.verified.booleanValue, false);
  assert.equal(fields.createdAt.timestampValue, '2026-11-10T21:00:00.000Z');
  assert.equal(fields.expireAt.timestampValue, '2026-11-11T21:00:00.000Z');
  assert.equal(writes[1].update.fields.uid.stringValue, 'bob');
  assert.equal(writes[1].update.fields.lastAt.timestampValue, '2026-11-10T21:00:00.000Z');
  assert.equal(Object.keys(fields).sort().join(), 'anonymous,createdAt,displayName,expireAt,photoURL,text,uid,verified');
  const oauth = fetcher.calls.find(function(c) { return c.url.startsWith('https://oauth2.googleapis.com/token'); });
  const assertion = new URLSearchParams(oauth.init.body).get('assertion');
  const claim = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(assertion.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), function(c) { return c.charCodeAt(0); })));
  assert.equal(claim.scope, 'https://www.googleapis.com/auth/datastore');
  assert.equal(claim.iss, 'comments@railroadradar-accounts.iam.gserviceaccount.com');
});

test('an unsafe Llama Guard verdict is blocked and the profanity model is not called', async () => {
  const fetcher = router({ guard: 'unsafe\nS10' });
  const res = await call(fetcher, await signToken(tokenPayload()));
  assert.equal(res.status, 400);
  assert.equal(res.json.error, "This comment can't be posted. Please keep it friendly.");
  assert.equal(fetcher.calls.some(function(c) { return c.url.includes('documents:commit'); }), false);
  assert.equal(fetcher.ai.calls.length, 1);
  const sexual = router({ guard: 'unsafe\nS12' });
  assert.equal((await call(sexual, await signToken(tokenPayload()))).status, 400);
  const threat = router({ guard: 'unsafe\nS1' });
  assert.equal((await call(threat, await signToken(tokenPayload()))).status, 400);
});

test('profanity from the instruct model is blocked, and AI errors fail closed', async () => {
  const swearing = router({ guard: 'safe', profanity: '{"profanity":true}' });
  const res = await call(swearing, await signToken(tokenPayload()));
  assert.equal(res.status, 400);
  assert.equal(res.json.error, "This comment can't be posted. Please keep it friendly.");
  assert.equal(swearing.calls.some(function(c) { return c.url.includes('documents:commit'); }), false);
  const down = router({ throw: true });
  const res2 = await call(down, await signToken(tokenPayload()));
  assert.equal(res2.status, 503);
  assert.equal(res2.json.error, 'Comments are temporarily unavailable.');
  assert.equal(down.calls.some(function(c) { return c.url.includes('documents:commit'); }), false);
  const messy = router({ guard: 'not a verdict' });
  assert.equal((await call(messy, await signToken(tokenPayload()))).status, 503);
});

test('a second post inside 30 seconds is denied', async () => {
  const recent = router({ rate: { fields: { lastAt: { timestampValue: new Date(NOW - 30000).toISOString() } } } });
  const res = await call(recent, await signToken(tokenPayload()));
  assert.equal(res.status, 429);
  assert.equal(res.json.error, 'Please wait 30 seconds before posting again.');
  assert.equal(recent.ai.calls.length, 0);
  const older = router({ rate: { fields: { lastAt: { timestampValue: new Date(NOW - 30001).toISOString() } } } });
  const res2 = await call(older, await signToken(tokenPayload()));
  assert.equal(res2.status, 200);
});

test('text, thread, email, and ban checks happen before a write', async () => {
  const fetcher = router({});
  const token = await signToken(tokenPayload());
  assert.equal((await call(fetcher, token, { threadId: THREAD, text: '  ' })).status, 400);
  assert.equal((await call(fetcher, token, { threadId: THREAD, text: 'x'.repeat(201) })).status, 400);
  assert.equal((await call(fetcher, token, { threadId: THREAD, text: 'hi <b>' })).status, 400);
  assert.equal((await call(fetcher, token, { threadId: 'nope', text: 'hi' })).status, 400);
  assert.equal(fetcher.ai.calls.length, 0);
  const unverified = router({});
  const res = await call(unverified, await signToken(tokenPayload({ email_verified: false })));
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'Verify your email to comment.');
  const banned = router({ bannedEmail: true });
  const res2 = await call(banned, await signToken(tokenPayload()));
  assert.equal(res2.status, 403);
  assert.match(banned.calls.find(function(c) { return c.url.includes('/bannedEmails/'); }).url, /bob%40example.com/);
});

test('anonymous mode hides the photo and the verified check', async () => {
  const fetcher = router({
    settings: { fields: { reportDisplayMode: { stringValue: 'anonymous' }, reportCustomLabel: { stringValue: '' } } },
    verified: true
  });
  const res = await call(fetcher, await signToken(tokenPayload()));
  assert.equal(res.status, 200);
  const fields = commitBody(fetcher).writes[0].update.fields;
  assert.equal(fields.displayName.stringValue, 'Anonymous');
  assert.equal(fields.anonymous.booleanValue, true);
  assert.equal(fields.photoURL.nullValue, null);
  assert.equal(fields.verified.booleanValue, false);
});

test('a verified reporter keeps the check when the name is public', async () => {
  const fetcher = router({ verified: true });
  await call(fetcher, await signToken(tokenPayload()));
  const fields = commitBody(fetcher).writes[0].update.fields;
  assert.equal(fields.verified.booleanValue, true);
  assert.equal(fields.displayName.stringValue, 'Maya C.');
});

test('a bad token or another site is rejected', async () => {
  const fetcher = router({});
  const expired = await call(fetcher, await signToken(tokenPayload({ exp: Math.floor(NOW / 1000) - 10 })));
  assert.equal(expired.status, 401);
  const other = await call(fetcher, await signToken(tokenPayload({ aud: 'other-project' })));
  assert.equal(other.status, 401);
  const foreign = await call(fetcher, await signToken(tokenPayload()), { threadId: THREAD, text: 'hi' }, 'https://evil.example');
  assert.equal(foreign.status, 403);
  assert.equal(foreign.cors, null);
  const local = await call(router({}), await signToken(tokenPayload()), { threadId: THREAD, text: 'hi' }, 'http://127.0.0.1:8099');
  assert.equal(local.status, 200);
  assert.equal(local.cors, 'http://127.0.0.1:8099');
});

test('identity helper strips an email-shaped custom label', () => {
  const who = commentIdentity({ reportDisplayMode: 'custom', reportCustomLabel: 'bob@example.com', verifiedReporter: true }, { name: 'Maya Chen', picture: 'http://evil.example/a.png' });
  assert.equal(who.displayName.includes('@'), false);
  assert.equal(who.photoURL, null);
  assert.equal(who.verified, true);
  assert.deepEqual(parseGuardVerdict({ response: 'unsafe\nS10,S12' }), { safe: false, categories: ['S10', 'S12'] });
  assert.equal(parseGuardVerdict({ response: 'safe' }).safe, true);
  assert.equal(parseGuardVerdict({ response: 'hello' }), null);
  assert.equal(parseProfanity({ response: 'Sure {"profanity":false}' }), false);
  assert.equal(parseProfanity({ response: 'nope' }), null);
});

test('the service account can come from FIREBASE_SA_JSON or from base64 FIREBASE_SA_JSON_B64', async () => {
  const raw = serviceAccountCredentials({ FIREBASE_SA_JSON: '  ' + saJson + '\n', FIREBASE_SA_JSON_B64: 'ignore-me' });
  assert.equal(raw.client_email, 'comments@railroadradar-accounts.iam.gserviceaccount.com');
  const fromB64 = serviceAccountCredentials({ FIREBASE_SA_JSON_B64: '\n' + btoa(saJson) + '  ' });
  assert.equal(fromB64.client_email, 'comments@railroadradar-accounts.iam.gserviceaccount.com');
  assert.equal(serviceAccountCredentials({}), null);
  assert.equal(serviceAccountCredentials({ FIREBASE_SA_JSON: '{', FIREBASE_SA_JSON_B64: btoa(saJson) }), null);
  assert.equal(serviceAccountCredentials({ FIREBASE_SA_JSON_B64: '@@@' }), null);

  const viaB64 = router({});
  const token = await signToken(tokenPayload());
  const ok = await call(viaB64, token, null, null, { FIREBASE_SA_JSON: '', FIREBASE_SA_JSON_B64: btoa(saJson) });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.ok, true);

  const missing = router({});
  const res = await call(missing, token, null, null, { FIREBASE_SA_JSON: '', FIREBASE_SA_JSON_B64: '' });
  assert.equal(res.status, 503);
  assert.equal(res.json.error, 'Comments are temporarily unavailable.');
  assert.equal(missing.calls.some(function(c) { return c.url.includes('documents:commit'); }), false);
  assert.equal(missing.calls.some(function(c) { return c.url.startsWith('https://oauth2.googleapis.com/token'); }), false);

  const bad = router({});
  const res2 = await call(bad, token, null, null, { FIREBASE_SA_JSON: '', FIREBASE_SA_JSON_B64: 'not-valid-base64' });
  assert.equal(res2.status, 503);
  assert.equal(res2.json.error, 'Comments are temporarily unavailable.');
});
