// Routes every request a page makes: the site itself, pinned CDN libraries, recorded Worker responses, and nothing else.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

export const RECORD = !!process.env.RECORD;
export const WORKER_ORIGIN = 'https://railroadradar-proxy.railroadradar.workers.dev';
const FIXTURES = fileURLToPath(new URL('fixtures/', import.meta.url));
const INDEX = path.join(FIXTURES, 'index.json');

const BLANK_TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const CDN = [/^https:\/\/unpkg\.com\//, /^https:\/\/cdn\.jsdelivr\.net\/npm\//, /^https:\/\/www\.gstatic\.com\/firebasejs\//];

export const fixtures = fs.existsSync(INDEX)
  ? JSON.parse(fs.readFileSync(INDEX, 'utf8'))
  : { recordedAt: null, expectedTrains: {}, responses: {} };
if (RECORD) Object.assign(fixtures, { recordedAt: process.env.RECORDED_AT, expectedTrains: {} });

// Worker requests that were not recorded; the page gets a 404 for each, like a Worker route that is missing.
export const misses = new Set();
const cdnCache = new Map();

// Bodies are stored brotli-compressed: the raw feeds are several megabytes.
function bodyFile(key) {
  const slug = key.replace(/^\/api\//, '').split('?')[0].replace(/[^A-Za-z0-9]+/g, '-');
  return `${slug}-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 8)}.br`;
}

// Each Playwright worker records part of the run, so merge with what earlier workers saved.
export function saveFixtures() {
  const saved = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : { responses: {}, expectedTrains: {} };
  const out = {
    recordedAt: fixtures.recordedAt,
    expectedTrains: Object.keys(fixtures.expectedTrains).length ? fixtures.expectedTrains : saved.expectedTrains,
    responses: Object.fromEntries(Object.entries({ ...saved.responses, ...fixtures.responses }).sort())
  };
  fs.writeFileSync(INDEX, JSON.stringify(out, null, 1) + '\n');
}

async function workerRoute(route) {
  const req = route.request();
  const url = new URL(req.url());
  const key = url.pathname + url.search;
  if (url.pathname.startsWith('/api/mapbox/')) return route.fulfill({ status: 200, contentType: 'image/png', body: BLANK_TILE });
  // Recording only ever reads from the live Worker, and keeps the first answer for each URL so polls stay consistent.
  if (RECORD && req.method() === 'GET' && !fixtures.responses[key]) {
    const res = await route.fetch();
    const body = await res.body();
    const contentType = res.headers()['content-type'] || 'application/octet-stream';
    const file = bodyFile(key);
    fs.writeFileSync(path.join(FIXTURES, file), zlib.brotliCompressSync(body));
    fixtures.responses[key] = { status: res.status(), contentType, file };
    return route.fulfill({ status: res.status(), contentType, headers: { 'Access-Control-Allow-Origin': '*' }, body });
  }
  const hit = req.method() === 'GET' && fixtures.responses[key];
  if (!hit) {
    misses.add(`${req.method()} ${key}`);
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not recorded"}', headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  return route.fulfill({
    status: hit.status,
    contentType: hit.contentType,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: zlib.brotliDecompressSync(fs.readFileSync(path.join(FIXTURES, hit.file)))
  });
}

async function cdnRoute(route) {
  const url = route.request().url();
  if (!cdnCache.has(url)) {
    const res = await route.fetch();
    cdnCache.set(url, { status: res.status(), contentType: res.headers()['content-type'], headers: { 'Access-Control-Allow-Origin': '*' }, body: await res.body() });
  }
  return route.fulfill(cdnCache.get(url));
}

export async function routeNetwork(context, siteOrigin) {
  await context.route(() => true, (route) => {
    const url = route.request().url();
    if (url.startsWith(siteOrigin + '/')) return route.fallback();
    if (url.startsWith(WORKER_ORIGIN + '/')) return workerRoute(route);
    if (CDN.some((re) => re.test(url))) return cdnRoute(route);
    if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    // Firebase, Firestore, analytics and everything else third-party stays offline.
    return route.abort('blockedbyclient');
  });
}
