// Paste into railroadradar-proxy. Posts a press release to Discord for signed-in admins.
// Set the webhook as a Worker secret named DISCORD_PRESS_WEBHOOK; it must never appear in page source.

const PROJECT_ID = 'railroadradar-accounts';
const BOOTSTRAP_ADMIN_EMAILS = ['turokerr@gmail.com', 'railroadradar@gmail.com'];
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const PRESS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function b64urlBytes(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Returns the token's claims if it is a valid Firebase ID token for this project, else null.
async function verifyFirebaseIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const header = JSON.parse(new TextDecoder().decode(b64urlBytes(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64urlBytes(p)));
  const now = Date.now() / 1000;
  if (header.alg !== 'RS256' || claims.aud !== PROJECT_ID
    || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}`
    || !claims.sub || claims.exp < now || claims.iat > now + 300) return null;
  const { keys } = await (await fetch(GOOGLE_JWKS, { cf: { cacheTtl: 3600 } })).json();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  return ok ? claims : null;
}

async function isPressAdmin(token, claims) {
  const email = String(claims.email || '').toLowerCase();
  if (!email || claims.email_verified !== true) return false;
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) return true;
  // Firestore rules let a signed-in user read their own admins/{email} doc.
  const r = await fetch(`${FIRESTORE}/admins/${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok;
}

async function handlePressNotify(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PRESS_CORS });
  const reply = (status, msg) => new Response(msg, { status, headers: PRESS_CORS });
  if (request.method !== 'POST') return reply(405, 'POST only');

  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const claims = await verifyFirebaseIdToken(token).catch(() => null);
  if (!claims) return reply(401, 'Sign in again');
  if (!(await isPressAdmin(token, claims))) return reply(403, 'Admins only');

  const { slug } = await request.json().catch(() => ({}));
  if (!slug || typeof slug !== 'string') return reply(400, 'Missing slug');
  const doc = await fetch(`${FIRESTORE}/pressReleases/${encodeURIComponent(slug)}`);
  if (!doc.ok) return reply(404, 'No such press release');
  const f = (await doc.json()).fields || {};
  const title = String(f.title?.stringValue || 'Press release').slice(0, 256);
  const body = String(f.body?.stringValue || '').trim();
  const image = f.images?.arrayValue?.values?.[0]?.mapValue?.fields?.url?.stringValue;
  const url = `https://railroadradar.com/press/index.html?id=${encodeURIComponent(slug)}`;

  // Discord caps an embed description at 4096 characters and a message at 10 embeds.
  const chunks = [];
  for (let i = 0; i < body.length && chunks.length < 10; i += 4096) chunks.push(body.slice(i, i + 4096));
  if (!chunks.length) chunks.push('');
  const embeds = chunks.map((description, i) => ({
    title: i ? `${title} (cont.)`.slice(0, 256) : title,
    url,
    description,
    color: 706304,
    footer: { text: 'RailroadRadar Press' },
    timestamp: new Date().toISOString(),
  }));
  if (image) embeds[0].image = { url: image };

  const sent = await fetch(env.DISCORD_PRESS_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RailroadRadar', embeds }),
  });
  return reply(sent.ok ? 204 : 502, sent.ok ? null : 'Discord rejected the post');
}

// Inside the worker fetch handler:
// if (url.pathname === '/api/press/notify') return handlePressNotify(request, env);
