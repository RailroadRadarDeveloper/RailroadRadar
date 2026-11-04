import { WorkerEntrypoint } from 'cloudflare:workers';
/* RailroadRadar 24-Hour Train Replay sampler + API (Cloudflare Workers Free).
   Two Workers run this file:
   - railroadradar-replay (ROLE=commuter, cron every minute): MBTA, MNR, LIRR, Metra sampled at :00 and :30 of each
     minute (30 s), hourly booking/pruning, and GET /api/replay/hour for the map.
   - railroadradar-replay-amtrak (ROLE=amtrak, cron every minute): Amtrak and VIA sampled once a minute (60 s).
   Feeds come from railroadradar-proxy through a service binding (no API keys here; a workers.dev-to-workers.dev
   fetch on the same account is refused with error 1042). Data lives in the railroadradar-history D1
   database: one replay_hour row per railroad per UTC hour; each minute appends that minute's samples to it.
   Row text format:
     ids:  one train per line, "key\tlabel\troute" (a sample refers to a train by its line index)
     data: one sample per line, "sec|i,lat,lon,mph,hdg,age;i,lat,lon,mph,hdg,age;..." where sec = seconds into the
           hour, lat/lon = degrees x 1e5, mph = reported speed (blank when the feed has none), hdg = degrees (blank if
           unknown), age = seconds since the vehicle's own report (blank if unknown).
   Only public train positions are stored, no user data.
   Writes share the history worker's `budget` row (day = UTC date). Replay stops writing when the history writes
   plus replay writes for the day reach STOP_AT (85,000 of D1's 100,000 free rows written per day). */

const PROXY = 'https://railroadradar-proxy.railroadradar.workers.dev';
const PROXY_HEADERS = { Origin: 'https://railroadradar.com', Referer: 'https://railroadradar.com/', 'User-Agent': 'railroadradar-replay' };
const STOP_AT = 85000;
const KEEP_HOURS = 25;            // hour rows kept besides the current one (24 h window spans 25 buckets)
const RRS = ['amtrak', 'via', 'mbta', 'mnr', 'lirr', 'metra'];

// ---------- tiny protobuf reader for GTFS-RT VehiclePosition ----------
function varint(b, i) {
  let n = 0, m = 1, c;
  do { c = b[i++]; n += (c & 127) * m; m *= 128; } while (c & 128);
  return [n, i];
}
function fields(b, s, e, cb) {
  let i = s;
  while (i < e) {
    let t; [t, i] = varint(b, i);
    const f = t >>> 3, w = t & 7;
    if (w === 0) { let v; [v, i] = varint(b, i); cb(f, 0, v, 0); }
    else if (w === 1) { i += 8; }
    else if (w === 5) { cb(f, 5, i, 0); i += 4; }
    else if (w === 2) { let l; [l, i] = varint(b, i); cb(f, 2, i, i + l); i += l; }
    else break;
  }
}
const str = (b, s, e) => String.fromCharCode.apply(null, b.subarray(s, e));
function gtfsVehicles(buf) {
  const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength), out = [];
  fields(b, 0, b.length, (f, w, s, e) => {
    if (f !== 2 || w !== 2) return;                       // FeedMessage.entity
    let eid = '', has = false;
    const v = { eid: '', tripId: '', routeId: '', vid: '', vlabel: '', lat: NaN, lon: NaN, bearing: null, speed: null, ts: 0 };
    fields(b, s, e, (f2, w2, s2, e2) => {
      if (f2 === 1 && w2 === 2) eid = str(b, s2, e2);
      else if (f2 === 4 && w2 === 2) {                    // FeedEntity.vehicle
        has = true;
        fields(b, s2, e2, (f3, w3, s3, e3) => {
          if (f3 === 1 && w3 === 2) fields(b, s3, e3, (f4, w4, s4, e4) => {   // trip
            if (w4 !== 2) return;
            if (f4 === 1) v.tripId = str(b, s4, e4); else if (f4 === 5) v.routeId = str(b, s4, e4);
          });
          else if (f3 === 2 && w3 === 2) fields(b, s3, e3, (f4, w4, s4) => {  // position
            if (w4 !== 5) return;
            const x = dv.getFloat32(s4, true);
            if (f4 === 1) v.lat = x; else if (f4 === 2) v.lon = x; else if (f4 === 3) v.bearing = x; else if (f4 === 5) v.speed = x;
          });
          else if (f3 === 5 && w3 === 0) v.ts = s3;
          else if (f3 === 8 && w3 === 2) fields(b, s3, e3, (f4, w4, s4, e4) => { // vehicle descriptor
            if (w4 !== 2) return;
            if (f4 === 1) v.vid = str(b, s4, e4); else if (f4 === 2) v.vlabel = str(b, s4, e4);
          });
        });
      }
    });
    if (has && isFinite(v.lat) && isFinite(v.lon) && v.lat !== 0) { v.eid = eid; out.push(v); }
  });
  return out;
}

// Train numbers the same way the live map shows them.
function lirrNum(eid, tripId) {
  const fromId = (raw) => {
    const parts = String(raw || '').trim().split('_'); let last = null;
    for (let i = parts.length - 1; i >= 0; i--) if (/^\d+$/.test(parts[i])) { if (!last) last = parts[i]; if (parts[i].length >= 3) return parts[i]; }
    return last;
  };
  let id = String(eid || '').trim(); if (id.endsWith('_V') || id.endsWith('_T')) id = id.slice(0, -2);
  return fromId(tripId) || fromId(id) || id || '?';
}
function metraNum(tripId, vid) {
  const parts = String(tripId || '').trim().split('_');
  if (parts.length >= 2 && /\d/.test(parts[1])) return parts[1];
  for (const p of parts) if (/\d/.test(p)) return p;
  return vid || '?';
}

// ---------- feeds → [{key,label,route,lat,lon,mph,hdg,ts}] ----------
let proxyFetcher = null;   // env.PROXY service binding, set per invocation
async function getFeed(path, kind) {
  const r = await proxyFetcher.fetch(new Request(PROXY + path, { headers: PROXY_HEADERS }));
  if (!r.ok) throw new Error(path + ' HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120).replace(/\s+/g, ' '));
  return kind === 'json' ? r.json() : kind === 'text' ? r.text() : r.arrayBuffer();
}
const MPS_TO_MPH = 2.23693629;
const FEEDS = {
  mnr: async () => gtfsVehicles(await getFeed('/api/mta/mnr', 'bin')).map((v) => ({
    key: v.eid, label: v.eid, route: v.routeId, lat: v.lat, lon: v.lon,
    mph: v.speed != null ? v.speed * MPS_TO_MPH : null, hdg: v.bearing, ts: v.ts })),
  lirr: async () => {
    const seen = new Set();
    return gtfsVehicles(await getFeed('/api/mta/lirr', 'bin')).map((v) => {
      const num = lirrNum(v.eid, v.tripId); let key = num;
      if (seen.has(key)) key = v.eid; seen.add(key);
      return { key, label: num, route: v.routeId, lat: v.lat, lon: v.lon, mph: v.speed != null ? v.speed * MPS_TO_MPH : null, hdg: v.bearing, ts: v.ts };
    });
  },
  metra: async () => gtfsVehicles(await getFeed('/api/metra/positions', 'bin')).map((v) => ({
    key: v.vid || v.eid, label: metraNum(v.tripId, v.vid), route: v.routeId, lat: v.lat, lon: v.lon,
    mph: v.speed != null ? v.speed * MPS_TO_MPH : null, hdg: v.bearing, ts: v.ts })),
  mbta: async () => {
    const j = await getFeed('/api/mbta/vehicles?filter%5Broute_type%5D=2&include=trip&fields%5Btrip%5D=name&fields%5Bvehicle%5D=latitude,longitude,bearing,speed,updated_at,label', 'json');
    const names = {};
    for (const t of j.included || []) if (t.type === 'trip') names[t.id] = t.attributes && t.attributes.name;
    const out = [];
    for (const v of j.data || []) {
      const a = v.attributes || {}, rel = v.relationships || {};
      if (a.latitude == null || a.longitude == null) continue;
      const tripId = rel.trip && rel.trip.data && rel.trip.data.id;
      out.push({ key: v.id, label: (tripId && names[tripId]) || a.label || v.id, route: rel.route && rel.route.data && rel.route.data.id || '',
        lat: a.latitude, lon: a.longitude, mph: a.speed != null ? a.speed * MPS_TO_MPH : null, hdg: a.bearing,
        ts: a.updated_at ? Date.parse(a.updated_at) / 1000 : 0 });
    }
    return out;
  }
};

// Amtraker JSON is ~1.2 MB, mostly station lists; read only the fields needed with indexOf instead of JSON.parse.
const COMPASS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
async function amtrakFeed() {
  const s = await getFeed('/api/amtrak/trains', 'text');
  const out = { amtrak: [], via: [] };
  const START = '"dataSource":';
  let p = s.indexOf(START);
  while (p !== -1) {
    const next = s.indexOf(START, p + 13), end = next === -1 ? s.length : next;
    let c = p;                                    // keys appear in feed order, so each search starts at the last hit
    const get = (k, q) => {                       // q: true = string value
      const i = s.indexOf('"' + k + '":', c);
      if (i === -1 || i > end) return null;
      const j = i + k.length + 3; c = j;
      if (q) { if (s.charCodeAt(j) !== 34) return null; const z = s.indexOf('"', j + 1); return s.slice(j + 1, z); }
      let z = j; while (z < end && ',}]'.indexOf(s[z]) === -1) z++;
      return s.slice(j, z);
    };
    const routeName = get('routeName', true), trainNum = get('trainNum', true), trainID = get('trainID', true);
    const lat = Number(get('lat')), lon = Number(get('lon'));
    const lastSta = s.lastIndexOf('"stations":', end); if (lastSta > c) c = lastSta;
    const hdg = get('heading', true), state = get('trainState', true), vel = get('velocity'), last = get('lastValTS', true), prov = get('provider', true) || '';
    if (state === 'Active' && isFinite(lat) && isFinite(lon) && lat !== 0) {
      const rec = { key: trainID || trainNum, label: trainNum || '', route: routeName || '', lat, lon,
        mph: vel != null && vel !== 'null' && isFinite(Number(vel)) ? Number(vel) : null,
        hdg: COMPASS[hdg] ?? null, ts: last ? Date.parse(last) / 1000 : 0 };
      (/^via$/i.test(prov) ? out.via : out.amtrak).push(rec);
    }
    p = next;
  }
  return out;
}

// ---------- storage ----------
const clean = (x) => String(x == null ? '' : x).replace(/[\t\n|;,]/g, ' ');
function encode(list, sec, tsNow, dict, keys) {
  const recs = [];
  for (const v of list) {
    if (!v.key) continue;
    let i = dict.get(v.key);
    if (i === undefined) { i = dict.size; dict.set(v.key, i); keys.push(clean(v.key) + '\t' + clean(v.label) + '\t' + clean(v.route)); }
    const mph = v.mph != null && isFinite(v.mph) && v.mph >= 0 && v.mph < 250 ? Math.round(v.mph) : '';
    const hdg = v.hdg != null && isFinite(v.hdg) ? Math.round(v.hdg) % 360 : '';
    const age = v.ts > 0 ? Math.max(0, Math.round(tsNow - v.ts)) : '';
    recs.push(i + ',' + Math.round(v.lat * 1e5) + ',' + Math.round(v.lon * 1e5) + ',' + mph + ',' + hdg + ',' + age);
  }
  return sec + '|' + recs.join(';') + '\n';
}
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

async function writtenToday(env, hour, nowMs) {
  const r = await env.DB.batch([
    env.DB.prepare('SELECT written FROM budget WHERE day = ?').bind(utcDay(nowMs)),
    env.DB.prepare('SELECT COALESCE(SUM(w - booked), 0) AS u FROM replay_hour WHERE hour >= ?').bind(hour - 2)
  ]);
  return ((r[0].results[0] && r[0].results[0].written) || 0) + (r[1].results[0].u || 0);
}

// samples: { rr: [ [sec, tsNow, list], ... ] }
async function store(env, hour, samples) {
  const rrs = Object.keys(samples).filter((rr) => samples[rr].length);
  if (!rrs.length) return 0;
  const cur = await env.DB.prepare('SELECT rr, ids FROM replay_hour WHERE hour = ? AND rr IN (' + rrs.map(() => '?').join(',') + ')')
    .bind(hour, ...rrs).all();
  const old = {}; for (const r of cur.results) old[r.rr] = r.ids;
  const stmts = [];
  for (const rr of rrs) {
    const keys = old[rr] ? old[rr].split('\n') : [], dict = new Map();
    keys.forEach((line, i) => dict.set(line.slice(0, line.indexOf('\t')), i));
    const before = keys.length;
    let data = '';
    for (const [sec, tsNow, list] of samples[rr]) data += encode(list, sec, tsNow, dict, keys);
    const ids = keys.join('\n'), n = samples[rr].length;
    if (old[rr] === undefined) {
      stmts.push(env.DB.prepare('INSERT INTO replay_hour (hour, rr, ids, data, n, w, booked) VALUES (?, ?, ?, ?, ?, 1, 0) ON CONFLICT(hour, rr) DO UPDATE SET ids = excluded.ids, data = data || excluded.data, n = n + excluded.n, w = w + 1')
        .bind(hour, rr, ids, data, n));
    } else if (keys.length !== before) {
      stmts.push(env.DB.prepare('UPDATE replay_hour SET ids = ?, data = data || ?, n = n + ?, w = w + 1 WHERE hour = ? AND rr = ?').bind(ids, data, n, hour, rr));
    } else {
      stmts.push(env.DB.prepare('UPDATE replay_hour SET data = data || ?, n = n + ?, w = w + 1 WHERE hour = ? AND rr = ?').bind(data, n, hour, rr));
    }
  }
  const res = await env.DB.batch(stmts);
  return res.reduce((a, r) => a + ((r.meta && r.meta.rows_written) || 0), 0);
}

// Hourly (commuter worker, minute 0): add replay's writes to the shared budget row and prune old hours.
async function bookAndPrune(env, hour, nowMs) {
  const q = await env.DB.batch([
    env.DB.prepare('SELECT COALESCE(SUM(w - booked), 0) AS u, COUNT(*) AS c FROM replay_hour WHERE booked < w'),
    env.DB.prepare('SELECT COUNT(*) AS c FROM replay_hour WHERE hour < ?').bind(hour - KEEP_HOURS)
  ]);
  const unbooked = q[0].results[0].u || 0, marks = q[0].results[0].c || 0, drops = q[1].results[0].c || 0;
  const add = unbooked + marks + drops + 1;
  const r = await env.DB.batch([
    env.DB.prepare('UPDATE replay_hour SET booked = w WHERE booked < w'),
    env.DB.prepare('DELETE FROM replay_hour WHERE hour < ?').bind(hour - KEEP_HOURS),
    env.DB.prepare('INSERT INTO budget (day, written) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET written = written + excluded.written').bind(utcDay(nowMs), add)
  ]);
  return { add, written: r.reduce((a, x) => a + ((x.meta && x.meta.rows_written) || 0), 0) };
}

const settle = (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: String(e && e.message || e) }));

// The commuter cron keeps its own CPU small: each 30 s sample of each feed pair runs in its own
// invocation (RPC on the Sampler entrypoint through the SELF service binding), so no single
// invocation parses more than two feeds once. Sampler is RPC-only, not reachable over HTTP.
const GROUPS = [['mbta', 'mnr'], ['lirr', 'metra']];
async function sampleGroup(env, hour, sec, rrs) {
  proxyFetcher = env.PROXY;
  const got = await Promise.all(rrs.map((n) => settle(FEEDS[n]())));
  const tsNow = Math.floor(Date.now() / 1000), samples = {}, errors = [], counts = {};
  rrs.forEach((n, i) => { if (got[i].ok) { samples[n] = [[sec, tsNow, got[i].v]]; counts[n] = got[i].v.length; } else errors.push(n + ': ' + got[i].e); });
  const rowsWritten = await store(env, hour, samples);
  return { counts, errors, rowsWritten };
}
export class Sampler extends WorkerEntrypoint {
  async sample(hour, sec, rrs) {
    rrs = (Array.isArray(rrs) ? rrs : []).filter((n) => FEEDS[n]);
    if (!(hour > 0) || !(sec >= 0 && sec < 3600) || !rrs.length) return { errors: ['bad args'] };
    return sampleGroup(this.env, hour, sec, rrs);
  }
}

async function runCommuter(env, startMs) {
  const hour = Math.floor(startMs / 3600000), sec0 = Math.floor((startMs % 3600000) / 1000);
  const log = { role: 'commuter', hour, errors: [], counts: {}, rowsWritten: 0 };
  const total = await writtenToday(env, hour, startMs);
  log.writtenToday = total;
  if (total >= STOP_AT) { log.skipped = 'budget'; console.log(JSON.stringify(log)); return; }
  if (sec0 < 60) log.book = await bookAndPrune(env, hour, startMs);
  const take = async (sec) => {
    const res = await Promise.all(GROUPS.map((g) => settle(env.SELF.sample(hour, sec, g))));
    res.forEach((r, i) => {
      if (!r.ok) { log.errors.push(GROUPS[i].join('+') + ': ' + r.e); return; }
      log.errors.push(...r.v.errors); log.rowsWritten += r.v.rowsWritten || 0;
      for (const [k, n] of Object.entries(r.v.counts || {})) log.counts[k] = (log.counts[k] ? log.counts[k] + '/' : '') + n;
    });
  };
  await take(sec0);
  await scheduler.wait(Math.max(0, startMs + 30000 - Date.now()));
  await take(Math.min(3599, sec0 + 30));
  console.log(JSON.stringify(log));
}

async function runAmtrak(env, startMs) {
  const hour = Math.floor(startMs / 3600000), sec = Math.floor((startMs % 3600000) / 1000);
  const log = { role: 'amtrak', hour, errors: [] };
  const total = await writtenToday(env, hour, startMs);
  log.writtenToday = total;
  if (total >= STOP_AT) { log.skipped = 'budget'; console.log(JSON.stringify(log)); return; }
  const got = await settle(amtrakFeed());
  if (!got.ok) { log.errors.push('amtrak: ' + got.e); console.log(JSON.stringify(log)); return; }
  const tsNow = Math.floor(Date.now() / 1000);
  log.counts = { amtrak: got.v.amtrak.length, via: got.v.via.length };
  log.rowsWritten = await store(env, hour, { amtrak: [[sec, tsNow, got.v.amtrak]], via: [[sec, tsNow, got.v.via]] });
  console.log(JSON.stringify(log));
}

// ---------- HTTP API ----------
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' };
function json(body, status, cache) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, ...CORS } });
}
async function handleHour(request, env, ctx, url) {
  const nowHour = Math.floor(Date.now() / 3600000);
  const h = parseInt(url.searchParams.get('h') || '', 10);
  if (!(h >= nowHour - KEEP_HOURS && h <= nowHour)) return json({ error: 'h must be a UTC hour number (epoch ms / 3600000) within the last 25 hours', now: nowHour }, 400, 'no-store');
  const want = (url.searchParams.get('rr') || RRS.join(',')).split(',').map((s) => s.trim().toLowerCase()).filter((s) => RRS.includes(s));
  const rrs = [...new Set(want)].sort();
  if (!rrs.length) return json({ error: 'rr must list railroads: ' + RRS.join(',') }, 400, 'no-store');
  const done = h < nowHour;
  const cacheKey = new Request(url.origin + '/api/replay/hour?h=' + h + '&rr=' + rrs.join(','));
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const r = await env.DB.prepare('SELECT rr, ids, data, n FROM replay_hour WHERE hour = ? AND rr IN (' + rrs.map(() => '?').join(',') + ')').bind(h, ...rrs).all();
  const out = { h, step: { mbta: 30, mnr: 30, lirr: 30, metra: 30, amtrak: 60, via: 60 }, complete: done, rr: {} };
  for (const row of r.results) out.rr[row.rr] = { ids: row.ids, data: row.data, n: row.n };
  const res = json(out, 200, done ? 'public, max-age=86400' : 'public, max-age=30');
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

export default {
  async scheduled(controller, env, ctx) {
    const startMs = controller.scheduledTime || Date.now();
    proxyFetcher = env.PROXY;
    if (env.ROLE === 'amtrak') await runAmtrak(env, startMs);
    else await runCommuter(env, startMs);
  },
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/replay/hour' && env.ROLE !== 'amtrak') return handleHour(request, env, ctx, url);
    if (request.method === 'GET' && url.pathname === '/api/replay/status' && env.ROLE !== 'amtrak') {
      const r = await env.DB.prepare('SELECT rr, MIN(hour) AS first, MAX(hour) AS last, COUNT(*) AS hours FROM replay_hour GROUP BY rr').all();
      return json({ now: Math.floor(Date.now() / 3600000), railroads: r.results }, 200, 'public, max-age=60');
    }
    return json({ error: 'not found' }, 404, 'no-store');
  }
};
