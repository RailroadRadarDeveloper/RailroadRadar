/**
 * Train comments. The browser never writes Firestore.
 * Workers AI is the only classifier — there is no local word list.
 *
 * POST /comment  { threadId, text }
 * Authorization: Bearer <Firebase ID token>
 *
 * Deploy name: railroadradar-comments
 * https://railroadradar-comments.railroadradar.workers.dev/comment
 */

const PROJECT_DEFAULT = 'railroadradar-accounts';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const GUARD_MODEL_DEFAULT = '@cf/meta/llama-guard-3-8b';
const PROFANITY_MODEL_DEFAULT = '@cf/meta/llama-3.1-8b-instruct-fast';
const PROFANITY_SYSTEM = 'You moderate one public train-rider comment. Decide whether it contains profanity or a slur. Reply with JSON only: {"profanity":true} or {"profanity":false}.';

const FRIENDLY = "This comment can't be posted. Please keep it friendly.";
const UNAVAILABLE = 'Comments are temporarily unavailable.';
const RATE_MSG = 'Please wait 30 seconds before posting again.';
const TEXT_MSG = "Comment must be 1–200 characters and can't include < or >.";
const THREAD_RE = /^[a-z0-9][a-z0-9-]{0,15}_[a-z0-9][a-z0-9-]{0,59}_[a-z0-9][a-z0-9-]{0,15}_[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const PHOTO_RE = /^https:\/\/lh[0-9]+\.googleusercontent\.com\//;
const RATE_MS = 30 * 1000;

const FIXED_ORIGINS = new Set(['https://railroadradar.com', 'https://www.railroadradar.com']);

let jwksCache = { keys: null, exp: 0 };
let accessCache = { token: '', exp: 0, email: '' };

export function resetCommentCaches() {
  jwksCache = { keys: null, exp: 0 };
  accessCache = { token: '', exp: 0, email: '' };
}

export class CommentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function projectId(env) {
  return String(env && env.PROJECT_ID || PROJECT_DEFAULT);
}

function tokenIss(env) {
  return 'https://securetoken.google.com/' + projectId(env);
}

export function originAllowed(origin) {
  if (!origin || FIXED_ORIGINS.has(origin)) return !!origin && FIXED_ORIGINS.has(origin);
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch (_) {
    return false;
  }
}

function jsonResponse(origin, status, body) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToPkcs8(pem) {
  const b64 = String(pem).replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  return b64urlToBytes(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''));
}

export function commentTextProblem(text) {
  if (typeof text !== 'string') return TEXT_MSG;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200 || trimmed.indexOf('<') !== -1 || trimmed.indexOf('>') !== -1) return TEXT_MSG;
  return '';
}

export function threadOk(id) {
  return typeof id === 'string' && THREAD_RE.test(id);
}

function firstInitial(displayName) {
  const raw = String(displayName || '').trim();
  if (!raw) return 'Anonymous';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
}

export function commentIdentity(settings, token) {
  const mode = settings && settings.reportDisplayMode || 'first_initial';
  let label = 'Anonymous';
  if (mode === 'full_name') label = String(token && token.name || '').trim() || 'Anonymous';
  else if (mode === 'custom') label = String(settings && settings.reportCustomLabel || '').trim() || firstInitial(token && token.name);
  else if (mode !== 'anonymous') label = firstInitial(token && token.name);
  label = label.replace(/[<>@]/g, '').trim().slice(0, 80) || 'Anonymous';
  const anonymous = label === 'Anonymous';
  const picture = token && token.picture;
  const photoURL = !anonymous && typeof picture === 'string' && picture.length <= 500 && PHOTO_RE.test(picture) ? picture : null;
  const verified = !anonymous && !!(settings && settings.verifiedReporter);
  return { displayName: label, anonymous: anonymous, photoURL: photoURL, verified: verified };
}

async function googleKeys(fetcher, now) {
  if (jwksCache.keys && jwksCache.exp > now) return jwksCache.keys;
  const res = await fetcher(JWKS_URL);
  if (!res.ok) throw new CommentError(503, UNAVAILABLE);
  const body = await res.json();
  const keys = {};
  (body.keys || []).forEach(function(k) { if (k && k.kid) keys[k.kid] = k; });
  jwksCache = { keys: keys, exp: now + 60 * 60 * 1000 };
  return keys;
}

export async function verifyFirebaseIdToken(token, env, fetcher, now) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new CommentError(401, 'Sign in to comment.');
  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch (_) {
    throw new CommentError(401, 'Sign in to comment.');
  }
  if (!header || header.alg !== 'RS256' || !header.kid) throw new CommentError(401, 'Sign in to comment.');
  const keys = await googleKeys(fetcher, now);
  const jwk = keys[header.kid];
  if (!jwk) throw new CommentError(401, 'Sign in to comment.');
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (!valid) throw new CommentError(401, 'Sign in to comment.');
  if (payload.iss !== tokenIss(env) || payload.aud !== projectId(env)) throw new CommentError(401, 'Sign in to comment.');
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) throw new CommentError(401, 'Sign in to comment.');
  if (typeof payload.sub !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.sub)) throw new CommentError(401, 'Sign in to comment.');
  return payload;
}

async function serviceAccountToken(env, fetcher, now) {
  let sa;
  try { sa = JSON.parse(env.FIREBASE_SA_JSON || ''); } catch (_) { sa = null; }
  if (!sa || !sa.client_email || !sa.private_key) throw new CommentError(503, UNAVAILABLE);
  if (accessCache.token && accessCache.email === sa.client_email && accessCache.exp > now + 15000) return accessCache.token;
  const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = {
    iss: sa.client_email,
    scope: DATASTORE_SCOPE,
    aud: OAUTH_URL,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600
  };
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify(claim)));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(header + '.' + payload));
  const assertion = header + '.' + payload + '.' + bytesToB64url(sig);
  const res = await fetcher(OAUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(assertion)
  });
  if (!res.ok) throw new CommentError(503, UNAVAILABLE);
  const body = await res.json();
  if (!body.access_token) throw new CommentError(503, UNAVAILABLE);
  const ttl = Number(body.expires_in || 3600);
  accessCache = { token: body.access_token, email: sa.client_email, exp: now + Math.max(30, ttl - 60) * 1000 };
  return body.access_token;
}

function firestoreDocUrl(project, path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/' + encodeURIComponent('(default)') + '/documents/' + encoded;
}

function firestoreDocName(project, path) {
  return 'projects/' + project + '/databases/(default)/documents/' + path;
}

function fsFields(obj) {
  const fields = {};
  Object.keys(obj).forEach(function(key) {
    const v = obj[key];
    if (v === null) fields[key] = { nullValue: null };
    else if (typeof v === 'string') fields[key] = { stringValue: v };
    else if (typeof v === 'boolean') fields[key] = { booleanValue: v };
    else if (v instanceof Date) fields[key] = { timestampValue: v.toISOString() };
  });
  return fields;
}

function fsString(doc, key) {
  const f = doc && doc.fields && doc.fields[key];
  return f && typeof f.stringValue === 'string' ? f.stringValue : '';
}

async function readDoc(project, path, access, fetcher) {
  const res = await fetcher(firestoreDocUrl(project, path), { headers: { authorization: 'Bearer ' + access } });
  if (res.status === 404) return null;
  if (!res.ok) throw new CommentError(503, UNAVAILABLE);
  return res.json();
}

export function modelText(raw) {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return '';
  if (typeof raw.response === 'string') return raw.response;
  if (raw.result && typeof raw.result.response === 'string') return raw.result.response;
  const choice = raw.choices && raw.choices[0] && raw.choices[0].message && raw.choices[0].message.content;
  return typeof choice === 'string' ? choice : '';
}

export function parseGuardVerdict(raw) {
  const text = modelText(raw).trim();
  if (!text) return null;
  const head = text.split(/\r?\n/).map(function(line) { return line.trim(); }).filter(Boolean)[0] || '';
  const word = head.toLowerCase().replace(/[^a-z].*$/, '');
  if (word !== 'safe' && word !== 'unsafe') return null;
  const categories = text.match(/\bS\d+\b/g) || [];
  return { safe: word === 'safe', categories: categories };
}

export function parseProfanity(raw) {
  const text = modelText(raw);
  const match = text.match(/\{[^{}]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    return obj && typeof obj.profanity === 'boolean' ? obj.profanity : null;
  } catch (_) {
    return null;
  }
}

async function moderate(text, env) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new CommentError(503, UNAVAILABLE);
  const guardModel = env.GUARD_MODEL || GUARD_MODEL_DEFAULT;
  const profanityModel = env.PROFANITY_MODEL || PROFANITY_MODEL_DEFAULT;
  let guardRaw;
  try {
    guardRaw = await env.AI.run(guardModel, {
      messages: [{ role: 'user', content: text }],
      max_tokens: 32
    });
  } catch (_) {
    throw new CommentError(503, UNAVAILABLE);
  }
  const verdict = parseGuardVerdict(guardRaw);
  if (!verdict) throw new CommentError(503, UNAVAILABLE);
  if (!verdict.safe) throw new CommentError(400, FRIENDLY);
  let profaneRaw;
  try {
    profaneRaw = await env.AI.run(profanityModel, {
      messages: [
        { role: 'system', content: PROFANITY_SYSTEM },
        { role: 'user', content: text }
      ],
      max_tokens: 24
    });
  } catch (_) {
    throw new CommentError(503, UNAVAILABLE);
  }
  const profane = parseProfanity(profaneRaw);
  if (profane == null) throw new CommentError(503, UNAVAILABLE);
  if (profane) throw new CommentError(400, FRIENDLY);
}

export async function handleRequest(request, env, fetcher) {
  const fetchImpl = fetcher || fetch;
  const originHeader = request.headers.get('origin') || '';
  const allowed = originAllowed(originHeader);
  const origin = allowed ? originHeader : '';
  if (request.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-max-age': '86400',
        vary: 'Origin'
      }
    });
  }
  if (!allowed) return jsonResponse('', 403, { error: 'Origin not allowed.' });
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/comment') {
    return jsonResponse(origin, 404, { error: 'Not found.' });
  }
  try {
    const now = typeof env.now === 'function' ? env.now() : Date.now();
    const auth = request.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new CommentError(401, 'Sign in to comment.');
    const token = await verifyFirebaseIdToken(match[1], env, fetchImpl, now);
    const raw = await request.text();
    if (raw.length > 4000) throw new CommentError(400, TEXT_MSG);
    let body;
    try { body = JSON.parse(raw); } catch (_) { throw new CommentError(400, TEXT_MSG); }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const textProblem = commentTextProblem(text);
    if (textProblem) throw new CommentError(400, textProblem);
    if (!threadOk(body.threadId)) throw new CommentError(400, "That train isn't available for comments.");
    if (token.email_verified !== true || typeof token.email !== 'string' || !token.email) {
      throw new CommentError(403, 'Verify your email to comment.');
    }
    const project = projectId(env);
    const access = await serviceAccountToken(env, fetchImpl, now);
    const email = token.email.toLowerCase();
    const uid = token.sub;
    const [rateDoc, banUser, banEmail, settingsDoc, verifiedDoc] = await Promise.all([
      readDoc(project, 'trainCommentRate/' + uid, access, fetchImpl),
      readDoc(project, 'bannedUsers/' + uid, access, fetchImpl),
      readDoc(project, 'bannedEmails/' + email, access, fetchImpl),
      readDoc(project, 'userSettings/' + uid, access, fetchImpl),
      readDoc(project, 'verifiedReporters/' + uid, access, fetchImpl)
    ]);
    if (banUser || banEmail) throw new CommentError(403, "This account can't comment.");
    const lastAt = rateDoc && rateDoc.fields && rateDoc.fields.lastAt && rateDoc.fields.lastAt.timestampValue;
    if (lastAt) {
      const elapsed = now - Date.parse(lastAt);
      if (!isFinite(elapsed) || elapsed <= RATE_MS) throw new CommentError(429, RATE_MSG);
    }
    await moderate(text, env);
    const mode = fsString(settingsDoc, 'reportDisplayMode');
    const allowedModes = ['first_initial', 'full_name', 'anonymous', 'custom'];
    const identity = commentIdentity({
      reportDisplayMode: allowedModes.indexOf(mode) !== -1 ? mode : 'first_initial',
      reportCustomLabel: fsString(settingsDoc, 'reportCustomLabel'),
      verifiedReporter: !!verifiedDoc
    }, token);
    const created = new Date(now);
    const commentId = crypto.randomUUID();
    const comment = {
      uid: uid,
      text: text,
      displayName: identity.displayName,
      anonymous: identity.anonymous,
      photoURL: identity.photoURL,
      verified: identity.verified,
      createdAt: created,
      expireAt: new Date(now + 24 * 60 * 60 * 1000)
    };
    const commit = {
      writes: [
        { update: { name: firestoreDocName(project, 'trainComments/' + body.threadId + '/items/' + commentId), fields: fsFields(comment) } },
        { update: { name: firestoreDocName(project, 'trainCommentRate/' + uid), fields: fsFields({ uid: uid, lastAt: created }) } }
      ]
    };
    const wrote = await fetchImpl('https://firestore.googleapis.com/v1/projects/' + project + '/databases/' + encodeURIComponent('(default)') + '/documents:commit', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
      body: JSON.stringify(commit)
    });
    if (!wrote.ok) throw new CommentError(503, UNAVAILABLE);
    console.log(JSON.stringify({ event: 'comment', outcome: 'posted', status: 200 }));
    return jsonResponse(origin, 200, { ok: true });
  } catch (err) {
    if (err instanceof CommentError) {
      console.log(JSON.stringify({ event: 'comment', outcome: 'rejected', status: err.status }));
      return jsonResponse(origin, err.status, { error: err.message });
    }
    console.log(JSON.stringify({ event: 'comment', outcome: 'error', status: 503 }));
    return jsonResponse(origin, 503, { error: UNAVAILABLE });
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};
