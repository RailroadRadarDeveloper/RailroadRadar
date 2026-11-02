#!/usr/bin/env node
/* Builds the static line and station pages under /lines/ and /stations/ and adds them to sitemap.xml.
   Stop lists come only from the railroads' official GTFS feeds; the line list, names and colors come from assets/shapes.
   The header, footer, cookie banner and analytics tags are copied from timetables/index.html so the pages match the site.

   Usage: node tools/seo-pages.mjs [--gtfs DIR] [--date YYYY-MM-DD]
     --gtfs DIR   read DIR/<railroad>.zip instead of downloading (missing files are downloaded into DIR)
     --date       the lastmod date written to sitemap.xml (default: today)
   Writes only new files under lines/ and stations/, and the generated block at the end of sitemap.xml. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://railroadradar.com';
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const GTFS_DIR = arg('--gtfs') || fs.mkdtempSync(path.join(os.tmpdir(), 'rr-gtfs-'));
const TODAY = arg('--date') || new Date().toISOString().slice(0, 10);

/* Official schedule feeds (the same sources the proxy Worker uses, plus the CTrail Hartford Line feed from CTtransit). */
const RAILROADS = [
  { rr: 'mbta', label: 'MBTA Commuter Rail', short: 'MBTA', gtfs: 'https://cdn.mbta.com/MBTA_GTFS.zip' },
  { rr: 'amtrak', label: 'Amtrak', short: 'Amtrak', gtfs: 'https://content.amtrak.com/content/gtfs/GTFS.zip' },
  { rr: 'mnr', label: 'Metro-North Railroad', short: 'Metro-North', gtfs: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip' },
  { rr: 'lirr', label: 'Long Island Rail Road', short: 'LIRR', gtfs: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip' },
  { rr: 'njt', label: 'NJ Transit Rail', short: 'NJ Transit', gtfs: 'https://www.njtransit.com/rail_data.zip' },
  { rr: 'marc', label: 'MARC Train', short: 'MARC', gtfs: 'https://feeds.mta.maryland.gov/gtfs/marc' },
  { rr: 'metra', label: 'Metra', short: 'Metra', gtfs: 'https://schedules.metrarail.com/gtfs/schedule.zip' },
  { rr: 'ctrail', label: 'CTrail', short: 'CTrail', gtfs: 'https://ctrides.com/hlgtfs.zip' },
  { rr: 'via', label: 'VIA Rail Canada', short: 'VIA Rail', gtfs: 'https://www.viarail.ca/sites/all/files/gtfs/viarail.zip' }
];
/* Links to each railroad's own schedule pages, which stay the authoritative source (checked by hand, November 2026). */
const MARC_PAGES = { 'MARC Penn Line': 'marc-penn', 'MARC Camden Line': 'marc-camden', 'MARC Brunswick Line': 'marc-brunswick' };
function officialLink(rr, l) {
  const url = rr === 'mbta' ? (l ? `https://www.mbta.com/schedules/${encodeURIComponent(l.key)}/timetable` : 'https://www.mbta.com/schedules/commuter-rail')
    : rr === 'marc' ? `https://www.mta.maryland.gov/schedule${l && MARC_PAGES[l.name] ? '/' + MARC_PAGES[l.name] : '?type=marc-train'}`
    : { amtrak: 'https://www.amtrak.com/train-schedules-timetables', mnr: 'https://www.mta.info/schedules', lirr: 'https://www.mta.info/schedules', njt: 'https://www.njtransit.com/schedules', metra: 'https://metra.com/schedules', ctrail: 'https://hartfordline.com/fares-schedules/', via: 'https://www.viarail.ca/en/plan/train-schedules' }[rr];
  return { url, label: `Official ${RAILROADS.find((r) => r.rr === rr).short} Schedule` };
}
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let best = 0, at = -1;
    const [y1, x1] = pts[a], [y2, x2] = pts[b], dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [y, x] = pts[i];
      let t = len ? ((x - x1) * dx + (y - y1) * dy) / len : 0; t = Math.max(0, Math.min(1, t));
      const ex = x1 + t * dx - x, ey = y1 + t * dy - y, d = ex * ex + ey * ey;
      if (d > best) { best = d; at = i; }
    }
    if (at > 0 && best > tol * tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r5 = (v) => Math.round(v * 1e5) / 1e5;
/* The route drawn on a page's map: the site's own shapes when it has them, otherwise the stations in running order. */
function linePaths(l, box) {
  const shape = shapes[l.rr] && shapes[l.rr].find((x) => String(x.id) === l.key);
  let paths = shape && shape.polylines && shape.polylines.length ? shape.polylines
    : [l.main, ...l.branches.map((b) => [b.from, ...b.stops, b.to].filter(Boolean))].map((ss) => ss.map((x) => [x.lat, x.lon]));
  if (box) {
    const inBox = (q) => q[0] >= box[0] && q[0] <= box[2] && q[1] >= box[1] && q[1] <= box[3];
    const cut = [];
    for (const pl of paths) { let run = []; for (const q of pl) { if (inBox(q)) run.push(q); else { if (run.length > 1) cut.push(run); run = []; } } if (run.length > 1) cut.push(run); }
    paths = cut;
  }
  /* Long routes are drawn at a coarser detail so pages stay light; the map starts zoomed out to the whole route anyway. */
  const all = paths.flat(), span = all.length ? Math.max(Math.max(...all.map((q) => q[0])) - Math.min(...all.map((q) => q[0])), Math.max(...all.map((q) => q[1])) - Math.min(...all.map((q) => q[1]))) : 0;
  const tol = Math.max(0.0002, span / 4000);
  return paths.map((pl) => simplify(pl, tol).map((q) => [r5(q[0]), r5(q[1])])).filter((pl) => pl.length > 1);
}
function mapHtml(m) {
  return `  <section class="lp-mapbox" aria-label="Live Map">
    <div class="lp-map" id="lp-map"><p class="lp-map-msg">Loading the Live Map...</p></div>
    <script type="application/json" id="lp-map-data">${JSON.stringify(m).replace(/</g, '\\u003c')}</script>
  </section>
`;
}
const officialHtml = (links) => `<p class="lp-official">${links.map((o) => `<a href="${esc(o.url)}" rel="noopener">${esc(o.label)}</a>`).join(' &middot; ')}</p>`;
const RR = Object.fromEntries(RAILROADS.map((r) => [r.rr, r]));

/* ---------- zip and csv ---------- */
function unzip(buf, want) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen).split('/').pop();
    p += 46 + nameLen + extraLen + commentLen;
    if (!want.includes(name)) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    out[name] = (method === 0 ? data : zlib.inflateRawSync(data)).toString('utf8').replace(/^\uFEFF/, '');
  }
  return out;
}
function splitCsv(line) {
  if (line.indexOf('"') < 0) return line.split(',').map((s) => s.trim());
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}
function csv(text, keep) {
  const lines = text.split(/\r?\n/);
  const head = splitCsv(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const v = splitCsv(lines[i]);
    const o = {};
    head.forEach((h, j) => { o[h] = v[j] == null ? '' : v[j]; });
    if (!keep || keep(o)) rows.push(o);
  }
  return rows;
}
async function loadFeed(r) {
  const file = path.join(GTFS_DIR, r.rr + '.zip');
  if (!fs.existsSync(file)) {
    console.log(`Downloading ${r.rr} GTFS from ${r.gtfs}`);
    const res = await fetch(r.gtfs, { headers: { 'user-agent': 'Mozilla/5.0 RailroadRadar page builder' } });
    if (!res.ok) throw new Error(`${r.rr} GTFS: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const files = unzip(fs.readFileSync(file), ['routes.txt', 'trips.txt', 'stops.txt', 'stop_times.txt', 'route_patterns.txt']);
  for (const f of ['routes.txt', 'trips.txt', 'stops.txt', 'stop_times.txt']) if (!files[f]) throw new Error(`${r.rr} GTFS has no ${f}`);
  return files;
}

/* ---------- names ---------- */
const SMALL = new Set(['and', 'of', 'the', 'at', 'to', 'in', 'on', 'via', 'de', 'du', 'des', 'la', 'le']);
const KEEP_UPPER = new Set(['NY', 'NJ', 'PA', 'MD', 'DC', 'VA', 'WV', 'CT', 'MA', 'RI', 'NH', 'ME', 'VT', 'US', 'BWI', 'MARC', 'UP', 'NEC', 'II', 'III', 'JFK', 'NYC', 'RR', 'MSU']);
/* Title Case. Mixed-case names from the feeds are kept as they are; all-caps names are re-cased. */
function titleCase(s) {
  s = String(s).replace(/\s+/g, ' ').trim();
  const allCaps = s === s.toUpperCase() && /[A-Z]/.test(s);
  return s.split(' ').map((w, i) => {
    if (!w) return w;
    const bare = w.replace(/[^A-Za-z]/g, '');
    if (allCaps) {
      if (KEEP_UPPER.has(bare) && bare.length === w.replace(/[.,()]/g, '').length) return w;
      w = w.toLowerCase().replace(/(^|[\s\-/(.&])([a-z])/g, (m, a, b) => a + b.toUpperCase());
      w = w.replace(/^(\d+)(St|Nd|Rd|Th)\b/, (m, n, t) => n + t.toLowerCase());
    }
    if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
function slugify(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
/* Amtrak's feed reuses some names (two Bostons, two Springfields) and cases a few oddly; these are Amtrak's own station names. */
const AMTRAK_NAMES = { BBY: 'Boston Back Bay', BOS: 'Boston South Station', BON: 'Boston North Station', STS: 'New Haven State Street', NHV: 'New Haven Union Station',
  NYP: 'New York Penn Station', NWK: 'Newark Penn Station', NRK: 'Newark, DE', BWI: 'BWI Airport', NFS: 'Niagara Falls, ON', NFL: 'Niagara Falls, NY',
  SPG: 'Springfield, MA', SPI: 'Springfield, IL', LEE: "Lee's Summit", WAS: 'Washington Union Station', ADM: 'Ardmore, OK', ARD: 'Ardmore, PA',
  AKY: 'Ashland, KY', ASD: 'Ashland, VA', BNC: 'Burlington, NC', BRL: 'Burlington, IA', BTN: 'Burlington, VT', BUR: 'Burbank Airport', CEN: 'Centralia, IL',
  CTL: 'Centralia, WA', CHS: 'Charleston, SC', CHW: 'Charleston, WV', CLA: 'Claremont, NH', CLM: 'Claremont, CA', DHM: 'Durham, NH', DNC: 'Durham, NC',
  GLE: 'Gainesville, TX', GNS: 'Gainesville, GA', JAN: 'Jackson, MS', JXN: 'Jackson, MI', LAF: 'Lafayette, IN', LFT: 'Lafayette, LA', LCN: 'Lincoln, IL',
  LNK: 'Lincoln, NE', LSV: 'Las Vegas, NM', PDX: 'Portland, OR', POR: 'Portland, ME', PNT: 'Pontiac, MI', PON: 'Pontiac, IL', VAC: 'Vancouver, BC',
  VAN: 'Vancouver, WA', WIL: 'Wilmington, DE', WMN: 'Wilmington, NC', WPK: 'Winter Park, FL', WPS: 'Winter Park, CO' };
function stopName(rr, name, id) {
  let n = String(name).replace(/\s+/g, ' ').trim();
  if (rr === 'amtrak') {
    if (AMTRAK_NAMES[id]) return AMTRAK_NAMES[id];
    n = n.replace(/\s+Amtrak(\s+(Station|Sta))?$/i, '').replace(/\s+Amtrak\s+/i, ' ').replace(/\bAt\b/g, 'at').replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase());
  }
  if (rr === 'marc') n = n.replace(/\s+MARC\b.*$/i, '').replace(/\s+(eb|wb|nb|sb)$/i, '').replace(/\bW VA\b/, 'WV');
  if (rr === 'ctrail') n = n.replace(/\s+STATION$/i, '');
  if (rr === 'njt' && /^30TH ST\.? PHL\.?$/i.test(n)) return 'Philadelphia 30th Street';
  n = titleCase(n);
  if (rr === 'marc' && n === 'Union Station') return 'Washington Union Station';
  if (rr === 'marc' && n === 'Penn Station') return 'Baltimore Penn Station';
  /* Metra marks a second stop of the same name with a trailing period. */
  if (rr === 'metra') n = n.replace(/([A-Za-z]{4,})\.$/, '$1');
  return n;
}
const plainDash = (s) => String(s).replace(/\s+-\s+/g, ' to ');
function lineDisplay(rr, name, gtfsShort) {
  if (rr === 'mbta') return name;
  if (rr === 'amtrak') return /^Amtrak\b/.test(name) ? name : 'Amtrak ' + name;
  if (rr === 'mnr') return 'Metro-North ' + name + ' Line';
  if (rr === 'lirr') return 'LIRR ' + name;
  if (rr === 'njt') return 'NJ Transit ' + name;
  if (rr === 'marc') return 'MARC ' + name;
  if (rr === 'metra') {
    const base = (name === 'Burlington Northern' && gtfsShort ? gtfsShort : name).replace(/^Metra\s+/, '');
    return 'Metra ' + (/(Line|Service|Corridor)$/.test(base) ? base : base + ' Line');
  }
  if (rr === 'ctrail') return 'CTrail ' + name;
  if (rr === 'via') return 'VIA Rail ' + plainDash(name);
  return name;
}

/* ---------- stop order ---------- */
const HUBS = /^(South Station|North Station|Grand Central|Grand Central Madison|Penn Station|New York Penn Station|Boston South Station|Boston North Station|Chicago OTC|Baltimore Penn Station|New York|Chicago Union Station|Chicago|Ogilvie Transportation Center|Millennium Station|LaSalle Street|Hoboken|Atlantic Terminal|Long Island City|Washington Union Station|Washington|Toronto|Montréal|Union Station)$/i;
/* Each distinct stop pattern is turned to run the same way as the longest one, then merged the way the timetables page merges
   trips: a stop the order does not have yet goes right after the stop before it on that trip. */
function buildLine(patterns) {
  patterns = patterns.filter((p) => p.seq.length >= 2).sort((a, b) => b.seq.length - a.seq.length || b.count - a.count);
  if (!patterns.length) return null;
  const order = patterns[0].seq.slice();
  const refDir = patterns[0].dir;
  const oriented = [];
  for (const p of patterns) {
    const shared = p.seq.filter((s) => order.includes(s));
    let seq = p.seq;
    if (shared.length >= 2) {
      if (order.indexOf(shared[0]) > order.indexOf(shared[shared.length - 1])) seq = seq.slice().reverse();
    } else if (p.dir !== '' && refDir !== '' && p.dir !== refDir) seq = seq.slice().reverse();
    oriented.push({ seq, count: p.count });
    let prev = -1;
    seq.forEach((s, i) => {
      const at = order.indexOf(s);
      if (at >= 0) { prev = at; return; }
      if (prev < 0) {
        const next = seq.slice(i + 1).map((x) => order.indexOf(x)).find((x) => x >= 0);
        const pos = next == null ? order.length : next;
        order.splice(pos, 0, s); prev = pos;
      } else { order.splice(prev + 1, 0, s); prev += 1; }
    });
  }
  const rank = new Map(order.map((s, i) => [s, i]));
  /* Service patterns: each distinct stop set, dropping any that another pattern already covers (expresses, short turns). */
  const groups = new Map();
  for (const p of oriented) {
    /* Keyed by stop set, but kept in the order trains actually run: lines with two city terminals are not one straight list. */
    const stopsRun = [...new Set(p.seq)];
    const key = stopsRun.slice().sort((a, b) => rank.get(a) - rank.get(b)).join('>');
    const g = groups.get(key) || { stops: stopsRun, count: 0 };
    g.count += p.count;
    groups.set(key, g);
  }
  let list = [...groups.values()];
  list = list.filter((g, i) => !list.some((h, j) => j !== i && h.stops.length >= g.stops.length && (h.stops.length > g.stops.length || j < i) && g.stops.every((s) => h.stops.includes(s))));
  list.sort((a, b) => b.stops.length - a.stops.length || b.count - a.count);
  /* Main list: the most-run of the longer patterns, then stretched by any pattern that runs on past either end. */
  const maxLen = list[0].stops.length;
  const main = list.filter((g) => g.stops.length >= maxLen * 0.75).sort((a, b) => b.count - a.count)[0].stops.slice();
  for (let grew = true; grew;) {
    grew = false;
    let best = null;
    for (const g of list) {
      const iEnd = g.stops.indexOf(main[main.length - 1]), iStart = g.stops.indexOf(main[0]);
      if (iEnd >= 0) {
        const tail = g.stops.slice(iEnd + 1);
        if (tail.length && !tail.some((s) => main.includes(s)) && (!best || tail.length > best.add.length)) best = { add: tail, end: true };
      }
      if (iStart > 0) {
        const headRun = g.stops.slice(0, iStart);
        if (!headRun.some((s) => main.includes(s)) && (!best || headRun.length > best.add.length)) best = { add: headRun, end: false };
      }
    }
    if (best) { if (best.end) main.push(...best.add); else main.unshift(...best.add); grew = true; }
  }
  const inMain = new Set(main);
  const branches = [];
  const seen = new Set();
  for (const g of list) {
    let run = [], before = null;
    const flush = (after) => {
      if (!run.length) return;
      const key = run.join('>');
      if (!seen.has(key)) { seen.add(key); branches.push({ stops: run, from: before, to: after }); }
      run = [];
    };
    for (const s of g.stops) {
      if (inMain.has(s)) { flush(s); before = s; } else run.push(s);
    }
    flush(null);
  }
  /* A branch that is part of a longer branch with the same junction adds nothing. */
  const kept = branches.filter((b, i) => !branches.some((c, j) => j !== i && c.stops.length > b.stops.length && b.stops.every((s) => c.stops.includes(s))));
  return { main, branches: kept };
}

function analyze(r, files, routeFilter) {
  const stops = csv(files['stops.txt']);
  const byId = new Map(stops.map((s) => [s.stop_id, s]));
  const routes = csv(files['routes.txt'], (x) => ['2', '100', '101', '102', '103', '106', '109'].includes(String(x.route_type).trim()));
  const wantRoutes = new Map(routes.filter(routeFilter).map((x) => [x.route_id, x]));
  let typical = null;
  if (files['route_patterns.txt']) {
    /* Typical and deviation patterns only; a route with neither (CapeFLYER off season) keeps its canonical pattern. */
    const pats = csv(files['route_patterns.txt']).filter((p) => wantRoutes.has(p.route_id));
    const hasTypical = new Set(pats.filter((p) => Number(p.route_pattern_typicality || 1) <= 2).map((p) => p.route_id));
    typical = new Set(pats.filter((p) => Number(p.route_pattern_typicality || 1) <= 2 || !hasTypical.has(p.route_id)).map((p) => p.route_pattern_id));
  }
  const trips = new Map();
  for (const t of csv(files['trips.txt'], (x) => wantRoutes.has(x.route_id))) {
    if (typical && t.route_pattern_id && !typical.has(t.route_pattern_id)) continue;
    trips.set(t.trip_id, t);
  }
  const seqs = new Map();
  const NOT_STOPS = new Set(stops.filter((x) => /^Canadian Border$/i.test(x.stop_name)).map((x) => x.stop_id));
  const text = files['stop_times.txt'];
  let pos = text.indexOf('\n');
  const head = splitCsv(text.slice(0, pos).trim());
  const iTrip = head.indexOf('trip_id'), iStop = head.indexOf('stop_id'), iSeq = head.indexOf('stop_sequence');
  const iPick = head.indexOf('pickup_type'), iDrop = head.indexOf('drop_off_type');
  while (pos < text.length) {
    let end = text.indexOf('\n', pos + 1); if (end < 0) end = text.length;
    const line = text.slice(pos + 1, end).replace(/\r$/, '');
    pos = end;
    if (!line) continue;
    const comma = line.indexOf(',');
    const firstField = line.slice(0, comma).replace(/"/g, '').trim();
    if (iTrip === 0 && !trips.has(firstField)) continue;
    const v = splitCsv(line);
    if (!trips.has(v[iTrip])) continue;
    /* Stops where trains neither pick up nor drop off are not stops for riders. */
    if (iPick >= 0 && iDrop >= 0 && v[iPick] === '1' && v[iDrop] === '1') continue;
    if (NOT_STOPS.has(v[iStop])) continue;
    let a = seqs.get(v[iTrip]); if (!a) seqs.set(v[iTrip], a = []);
    a.push([Number(v[iSeq]), v[iStop]]);
  }
  const parentOf = (id) => {
    const s = byId.get(id);
    return s && s.parent_station && byId.has(s.parent_station) ? s.parent_station : id;
  };
  /* Stations with the same cleaned name (MARC lists each platform as a stop) become one. */
  const keyOf = new Map();
  const canon = new Map();
  const kidsOf = new Map();
  for (const s of stops) {
    const id = parentOf(s.stop_id);
    const name = stopName(r.rr, byId.get(id).stop_name, id);
    const k = r.rr === 'marc' ? 'n:' + name.toLowerCase() : id;
    keyOf.set(s.stop_id, k);
    if (!canon.has(k)) canon.set(k, id);
    if (!kidsOf.has(k)) kidsOf.set(k, []);
    kidsOf.get(k).push(s.stop_id);
  }
  const perRoute = new Map();
  for (const [tid, a] of seqs) {
    const t = trips.get(tid);
    a.sort((x, y) => x[0] - y[0]);
    const seq = [];
    for (const [, sid] of a) { const k = keyOf.get(sid) || sid; if (seq[seq.length - 1] !== k) seq.push(k); }
    const name = wantRoutes.get(t.route_id);
    const groupKey = routeFilter.groupKey ? routeFilter.groupKey(name) : t.route_id;
    let m = perRoute.get(groupKey); if (!m) perRoute.set(groupKey, m = new Map());
    const key = seq.join('>') + '#' + (t.direction_id || '');
    const p = m.get(key) || { seq, dir: t.direction_id || '', count: 0 };
    p.count++; m.set(key, p);
  }
  const station = (k) => {
    const s = byId.get(canon.get(k) || k);
    return { key: r.rr + ':' + k, id: s.stop_id, code: s.stop_code || '', name: stopName(r.rr, s.stop_name, s.stop_id), lat: Number(s.stop_lat), lon: Number(s.stop_lon),
      kids: kidsOf.get(k) || [s.stop_id], zone: s.zone_id || '', address: s.stop_address || '', town: s.municipality || '', access: s.wheelchair_boarding || '' };
  };
  const out = new Map();
  for (const [k, m] of perRoute) {
    const line = buildLine([...m.values()]);
    if (!line) continue;
    /* Lines read outward from the big city terminal, the way railroads list them. */
    const hub = (key) => HUBS.test(station(key).name);
    if (hub(line.main[line.main.length - 1]) && !hub(line.main[0])) {
      line.main.reverse();
      line.branches = line.branches.map((b) => ({ stops: b.stops.slice().reverse(), from: b.to, to: b.from })).reverse();
    }
    line.all = [...new Set([...line.main, ...line.branches.flatMap((b) => b.stops)])];
    out.set(k, { line, station });
  }
  return { lines: out, routes: wantRoutes };
}

/* ---------- template from the timetables page ---------- */
function template() {
  const t = fs.readFileSync(path.join(ROOT, 'timetables/index.html'), 'utf8');
  const cut = (a, b) => { const i = t.indexOf(a); const j = t.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error('timetables/index.html changed: ' + a); return t.slice(i, j); };
  return {
    headTail: cut('<link rel="manifest"', '<style>'),
    css: cut('<style>', '/* Timetables page').slice('<style>'.length),
    header: cut('<header class="header">', '</header>') + '</header>',
    footer: cut('<footer class="footer">', '</footer>') + '</footer>',
    cookies: cut('<div id="rr-cookie-bar"', '<script src="/assets/js/app-cookie-consent.js'),
    scripts: cut('<script src="/assets/js/app-cookie-consent.js', '<script>\n') 
  };
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PAGE_CSS = `/* Line and station pages */
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.lp-hero{background:linear-gradient(180deg,#07093e 0%,#0d1263 100%);color:#fff;padding:22px 20px 32px}
.lp-hero-inner,.lp-wrap{width:min(1100px,100%);margin:0 auto}
.lp-crumbs{margin:0 0 14px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 8px;font-size:13px;color:#c9d4ea}
.lp-crumbs li+li::before{content:'/';margin-right:8px;color:rgba(255,255,255,.45)}
.lp-crumbs a{color:#fff;text-decoration:none}.lp-crumbs a:hover{text-decoration:underline}
.lp-hero h1{margin:0 0 10px;font-size:clamp(26px,4.6vw,38px);line-height:1.15;font-weight:700;text-wrap:balance}
.lp-lead{margin:0;max-width:44em;color:#c9d4ea;font-size:16px;line-height:1.5}
.lp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.lp-hero .rr-btn{height:40px}
.lp-hero h1+.lp-actions{margin-top:16px}
.lp-mapbox{width:min(1100px,100%);margin:20px auto 0;padding:0 20px;box-sizing:border-box}
.lp-map{position:relative;height:clamp(480px,62vh,560px);border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#e9edf3;z-index:0}
.lp-map-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;margin:0;color:var(--muted);font-size:14px}
.lp-map .leaflet-container{font-family:var(--font)}
.lp-map-note{margin:8px 2px 0;color:var(--muted);font-size:12.5px}
.lp-official{margin:14px 0 0;font-size:14px}
.lp-official a{color:var(--ink);font-weight:600}
@media (max-width:760px){.lp-mapbox{padding:0 12px;margin-top:14px}.lp-map{height:60vh;min-height:320px}}
.lp-wrap{padding:22px 16px 56px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
.lp-card{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:16px 18px;min-width:0}
.lp-card.wide{grid-column:1 / -1}
.lp-card[hidden]{display:none}
.lp-card h2{margin:0 0 4px;display:flex;align-items:center;gap:10px;font:700 20px/1.25 var(--font);color:var(--ink)}
.lp-card h2::before{content:'';width:5px;align-self:stretch;min-height:22px;border-radius:3px;background:var(--line-color,var(--rail-mbta))}
.lp-card h3{margin:16px 0 6px;font:700 15px/1.3 var(--font);color:var(--ink)}
.lp-sub{margin:0 0 12px;color:var(--muted);font-size:13.5px}
.lp-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0}
.lp-facts div{padding:10px 12px;background:var(--s-tint);border-radius:4px;min-width:0}
.lp-facts dt{color:var(--muted);font:500 12px/1.2 var(--font)}
.lp-facts dd{margin:3px 0 0;font:700 15px/1.3 var(--font);color:var(--ink);overflow-wrap:anywhere}
.lp-stops{list-style:none;margin:0;padding:0 0 0 4px}
.lp-stops li{position:relative;padding:5px 0 5px 22px;font-size:15px;line-height:1.35}
.lp-stops li::before{content:'';position:absolute;left:4px;top:0;bottom:0;width:4px;background:var(--line-color)}
.lp-stops li:first-child::before{top:50%}.lp-stops li:last-child::before{bottom:50%}
.lp-stops li::after{content:'';position:absolute;left:0;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--surface);border:3px solid var(--line-color);box-sizing:border-box}
.lp-stops a{color:var(--ink);font-weight:500}
.lp-stops small{color:var(--muted);font-size:12.5px;margin-left:6px}
.lp-cols{columns:2 240px;column-gap:28px}
.lp-cols li{break-inside:avoid}
.lp-links{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.lp-links li{display:flex;align-items:center;gap:10px;font-size:15px}
.lp-links li::before{content:'';flex:none;width:12px;height:12px;border-radius:50%;background:var(--c,var(--line-color))}
.lp-links a{color:var(--ink);font-weight:500}
.lp-links small{color:var(--muted)}
.lp-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.lp-rows li{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;padding:9px 0;border-top:1px solid var(--line);font-size:14px}
.lp-rows li:first-child{border-top:0}
.lp-rows b{font-weight:700;color:var(--ink)}
.lp-rows span{color:var(--muted)}
.lp-rows a{color:var(--ink)}
.lp-pill{display:inline-block;padding:2px 8px;border-radius:10px;font:700 12px/1.4 var(--font);background:var(--s-tint);color:var(--ink);white-space:nowrap}
.lp-pill.late{background:#fde7e9;color:#8a0f1c}.lp-pill.ok{background:#e3f4e8;color:#145c2c}
html.rr-theme-dark .lp-pill.late{background:#5a1a26;color:#ffd6dc}html.rr-theme-dark .lp-pill.ok{background:#173f2a;color:#c9f1d6}
.lp-alert{padding:10px 12px;margin:0 0 8px;border-left:4px solid #e0a100;background:var(--s-tint);border-radius:0 4px 4px 0;font-size:14px;line-height:1.45}
.lp-msg{margin:0;color:var(--muted);font-size:14px}
.lp-note{margin:12px 0 0;color:var(--muted);font-size:12.5px;line-height:1.45}
.lp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.lp-stats div{padding:10px 12px;background:var(--s-tint);border-radius:4px}
.lp-stats b{display:block;font:700 22px/1.2 var(--font);color:var(--ink)}
.lp-stats span{color:var(--muted);font-size:12.5px}
.lp-index{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:4px 24px;list-style:none;margin:0;padding:0}
.lp-index li{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:15px;min-width:0}
.lp-index li::before{content:'';flex:none;width:10px;height:10px;border-radius:50%;background:var(--c,var(--line-color))}
.lp-index a{color:var(--ink);font-weight:500;overflow-wrap:anywhere}
.lp-index small{color:var(--muted);margin-left:auto;white-space:nowrap;font-size:12.5px}
.lp-index.lp-az li{flex-wrap:wrap;align-items:baseline}
.lp-index.lp-az small{flex:1 1 100%;margin-left:20px;white-space:normal}
.lp-jump{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 4px;padding:0;list-style:none}
.lp-jump a{display:inline-block;padding:6px 10px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--ink);text-decoration:none;font:500 13px/1.2 var(--font)}
.lp-jump a:hover{border-color:var(--ink)}
@media (max-width:760px){.lp-wrap{grid-template-columns:minmax(0,1fr)}.lp-card{padding:14px}}
`;

function page(T, o) {
  const title = o.title + ' | RailroadRadar';
  const url = SITE + o.path;
  const ld = o.jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#07093e">
<title>${esc(title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RailroadRadar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/icons/icon-512.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${SITE}/assets/icons/icon-512.png">
${T.headTail.trim()}
<style>${T.css}${PAGE_CSS}</style>
${ld}
</head>
<body>
${T.header}

<main ${o.mainAttrs || ''}style="--line-color:${o.color}">
  <section class="lp-hero" aria-labelledby="lp-title">
    <div class="lp-hero-inner">
      <ol class="lp-crumbs" aria-label="Breadcrumb">${o.crumbs.map((c, i) => i < o.crumbs.length - 1 ? `<li><a href="${c[1]}">${esc(c[0])}</a></li>` : `<li aria-current="page">${esc(c[0])}</li>`).join('')}</ol>
      <h1 id="lp-title">${esc(o.h1)}</h1>
      ${o.lead ? `<p class="lp-lead">${o.lead}</p>` : ''}
      ${o.actions ? `<div class="lp-actions">${o.actions}</div>` : ''}
    </div>
  </section>
${o.map ? mapHtml(o.map) : ''}  <div class="lp-wrap">
${o.body}
  </div>
</main>

${T.footer}

${T.cookies.trim()}
${T.scripts.trim()}
${o.script || ''}
</body>
</html>
`;
}
function crumbsLd(crumbs, selfPath) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + (i === crumbs.length - 1 ? selfPath : c[1]) })) };
}
const listJoin = (a) => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

/* ---------- main ---------- */
const shapes = Object.fromEntries(RAILROADS.map((r) => {
  const f = path.join(ROOT, 'assets/shapes', r.rr + '.json');
  return [r.rr, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).routes : null];
}));
const lines = [];
const coverage = [];
for (const r of RAILROADS) {
  let files;
  try { files = await loadFeed(r); } catch (e) { coverage.push(`${r.short}: skipped, ${e.message}`); continue; }
  const known = shapes[r.rr];
  const byName = known ? new Map(known.map((s) => [s.name.toLowerCase(), s])) : null;
  const byId = known ? new Map(known.map((s) => [String(s.id), s])) : null;
  /* The site's own route list (assets/shapes) decides which lines get pages. Metra has no shapes file, so its GTFS routes are used. */
  const shapeFor = (route) => {
    if (!known) return null;
    const nm = String(route.route_long_name || route.route_short_name).toLowerCase();
    if (r.rr === 'amtrak' || r.rr === 'njt') return byName.get(nm) || null;
    if (r.rr === 'marc') return byId.get(route.route_id) || null;
    return byId.get(route.route_id) || byName.get(nm) || null;
  };
  const filter = (route) => !known || !!shapeFor(route);
  filter.groupKey = (route) => { const s = shapeFor(route); return s ? String(s.id) : route.route_id; };
  const { lines: built, routes } = analyze(r, files, filter);
  const skipped = known ? known.filter((s) => !built.has(String(s.id))).map((s) => s.name) : [];
  for (const [key, { line, station }] of built) {
    const route = [...routes.values()].find((x) => filter.groupKey(x) === key);
    const shape = known ? known.find((s) => String(s.id) === key) : null;
    const baseName = shape ? shape.name : (route.route_long_name || route.route_short_name);
    const ids = [...routes.values()].filter((x) => filter.groupKey(x) === key).map((x) => x.route_id);
    const name = lineDisplay(r.rr, baseName, route.route_short_name);
    lines.push({ rr: r.rr, key, ids, baseName, name, slug: slugify(name), color: '#' + String((shape && shape.color) || route.route_color || '07093e').replace(/^#/, ''),
      main: line.main.map(station), branches: line.branches.map((b) => ({ stops: b.stops.map(station), from: b.from && station(b.from), to: b.to && station(b.to) })),
      all: line.all.map(station) });
  }
  coverage.push(`${r.short}: ${built.size} line pages` + (skipped.length ? `; no GTFS trips for ${skipped.join(', ')}` : ''));
}

/* MBTA Commuter Rail stations, with every other railroad's line that stops at the same place (within 400 m). */
function meters(a, b) {
  const k = Math.PI / 180, x = (b.lon - a.lon) * k * Math.cos((a.lat + b.lat) * k / 2), y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
}
const stations = new Map();
for (const l of lines.filter((x) => x.rr === 'mbta')) {
  for (const s of l.all) {
    let st = stations.get(s.id);
    if (!st) stations.set(s.id, st = { ...s, slug: slugify(s.name), lines: [] });
    if (!st.lines.includes(l)) st.lines.push(l);
  }
}
for (const st of stations.values()) {
  for (const l of lines) {
    if (l.rr === 'mbta' || st.lines.includes(l)) continue;
    const hit = l.all.find((s) => meters(st, s) <= 400);
    if (hit) { st.lines.push(l); (st.other = st.other || {})[l.slug] = hit; }
  }
}
const slugs = new Map();
for (const st of [...stations.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  if (slugs.has(st.slug)) st.slug = st.slug + '-' + slugify(st.town || st.id);
  slugs.set(st.slug, st);
}
const lineSlugs = new Set();
for (const l of lines) { if (lineSlugs.has(l.slug)) l.slug = l.slug + '-' + l.rr; lineSlugs.add(l.slug); }
const stationOf = (l, s) => {
  if (l.rr === 'mbta') return stations.get(s.id);
  for (const st of stations.values()) if (st.other && st.other[l.slug] && st.other[l.slug].id === s.id) return st;
  return null;
};

const T = template();
const OUT = [];
function write(rel, html) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
  OUT.push(rel);
}
const RAIL_ORDER = ['mbta', 'amtrak', 'mnr', 'lirr', 'njt', 'marc', 'metra', 'ctrail', 'via'];
const LIVE = { mbta: 'live trains, delays and alerts', amtrak: 'live trains, delays and alerts', mnr: 'live trains, delays and alerts', lirr: 'live trains, delays and alerts', metra: 'live trains, delays and alerts' };
const HISTORY_KEY = (l) => {
  if (l.rr === 'mbta' || l.rr === 'amtrak') return l.baseName;
  if (l.rr === 'mnr') return l.baseName;
  if (l.rr === 'lirr') return /Branch$/.test(l.baseName) ? l.baseName.replace(/ Branch$/, '') : '';
  if (l.rr === 'njt') return ({ 'Atlantic City Rail Line': 'Atlantic City Line', 'Northeast Corridor': 'Northeast Corridor Line', 'Princeton Shuttle': 'Princeton Branch', 'Main/Bergen County Line': 'Main Line' })[l.baseName] || l.baseName;
  return '';
};
const widget = `<script src="/assets/js/line-pages.js?v=${(await import('node:crypto')).createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'assets/js/line-pages.js'))).digest('hex').slice(0, 10)}" defer></script>`;
const lineLink = (l) => `<a href="/lines/${l.slug}/">${esc(l.name)}</a>`;
const stopLi = (l, s, extra) => {
  const st = stationOf(l, s);
  return `<li>${st ? `<a href="/stations/${st.slug}/">${esc(s.name)}</a>` : esc(s.name)}${extra || ''}</li>`;
};
const linesCrumb = ['Lines', '/lines/'];
const home = ['Home', '/'];

for (const l of lines) {
  const R = RR[l.rr];
  const first = l.main[0].name, last = l.main[l.main.length - 1].name;
  const ends = [...new Set([last, ...l.branches.filter((b) => !b.to).map((b) => b.stops[b.stops.length - 1].name)])];
  const starts = [...new Set([first, ...l.branches.filter((b) => !b.from).map((b) => b.stops[0].name)])];
  const count = l.all.length;
  const path_ = `/lines/${l.slug}/`;
  const crumbs = [home, linesCrumb, [l.name, path_]];
  const hasHist = !!HISTORY_KEY(l), live = !!LIVE[l.rr];
  const title = `${l.name} Train Tracker: Live Map, ${hasHist ? 'Delays and On-Time Stats' : live ? 'Delays and Alerts' : 'Trains and Stations'}`;
  const desc = `Follow ${l.name} trains on the RailroadRadar live map${live ? ', with live delays and alerts' : ''}${hasHist ? ' and on-time history' : ''}. All ${count} stations from ${starts.join(' and ')} to ${ends.join(' and ')}, and MyTrips to log your rides.`;
  const runs = `between ${listJoin(starts)} and ${listJoin(ends)}`;
  const lead = `The ${esc(l.name)} is ${/^[AEIOU]/.test(R.label) ? 'an' : 'a'} ${esc(R.label)} ${l.rr === 'amtrak' || l.rr === 'via' ? 'route' : 'line'} with ${count} stations, running ${esc(runs)}. Follow its trains live on RailroadRadar.`;
  let stopsHtml = `<h3>${esc(first)} to ${esc(last)}</h3><ol class="lp-stops${l.main.length > 14 ? ' lp-cols' : ''}">${l.main.map((s) => stopLi(l, s)).join('')}</ol>`;
  for (const b of l.branches) {
    const head = b.from && b.to ? `Via ${b.stops[0].name}, Between ${b.from.name} and ${b.to.name}`
      : b.from ? `Branch to ${b.stops[b.stops.length - 1].name}, After ${b.from.name}`
      : `Branch From ${b.stops[0].name}, Joining at ${b.to.name}`;
    stopsHtml += `<h3>${esc(head)}</h3><ol class="lp-stops">${b.stops.map((s) => stopLi(l, s)).join('')}</ol>`;
  }
  const sameRail = lines.filter((x) => x.rr === l.rr && x !== l);
  const tt = l.rr === 'mbta' && l.key !== 'CapeFlyer' ? `<a class="rr-btn secondary" href="/timetables/?rr=mbta&amp;line=${encodeURIComponent(l.key)}">Timetable</a>` : '';
  const actions = `<a class="rr-btn" href="/map/">Open the Live Map</a>${tt}${tt ? '' : '<a class="rr-btn secondary" href="/timetables/">Timetables</a>'}`;
  const hist = HISTORY_KEY(l);
  const body = `    <section class="lp-card" id="live" aria-labelledby="live-title">
      <h2 id="live-title">Live Trains</h2>
      <p class="lp-sub">${LIVE[l.rr] ? 'Trains running on the line right now, with how late each one is.' : `Live ${esc(R.short)} trains are on the <a href="/map/">Live Map</a>.`}</p>
      <div id="lp-live"><p class="lp-msg">${LIVE[l.rr] ? 'Loading live trains...' : 'Open the Live Map to see trains on this line.'}</p></div>
    </section>
    <section class="lp-card" id="alerts" aria-labelledby="alerts-title"${LIVE[l.rr] ? '' : ' hidden'}>
      <h2 id="alerts-title">Service Alerts</h2>
      <p class="lp-sub">Current alerts from ${esc(R.short)} for this ${l.rr === 'amtrak' ? 'route' : 'line'}.</p>
      <div id="lp-alerts"><p class="lp-msg">Loading alerts...</p></div>
    </section>
    <section class="lp-card wide" id="history" aria-labelledby="history-title" hidden>
      <h2 id="history-title">How Is the Line Doing</h2>
      <p class="lp-sub" id="lp-history-range"></p>
      <div id="lp-history"></div>
      <p class="lp-note">From RailroadRadar's own samples of live train feeds. On time means 5 minutes late or less. Not official railroad statistics.</p>
    </section>
    <section class="lp-card wide" id="stations" aria-labelledby="stations-title">
      <h2 id="stations-title">Stations on the ${esc(l.name)}</h2>
      <p class="lp-sub">${count} stations, in order, from the ${esc(R.short)} schedule data.${l.branches.length ? ' Not every train serves every branch.' : ''}</p>
      ${stopsHtml}
    </section>
    <section class="lp-card wide" aria-labelledby="facts-title">
      <h2 id="facts-title">About the Line</h2>
      <dl class="lp-facts">
        <div><dt>Railroad</dt><dd>${esc(R.label)}</dd></div>
        <div><dt>Stations</dt><dd>${count}</dd></div>
        <div><dt>Ends</dt><dd>${esc(listJoin([...new Set([...starts, ...ends])]))}</dd></div>
      </dl>
      ${officialHtml([officialLink(l.rr, l)])}
      ${sameRail.length ? `<h3>Other ${esc(R.short)} ${l.rr === 'amtrak' || l.rr === 'via' ? 'Routes' : 'Lines'}</h3><ul class="lp-index">${sameRail.map((x) => `<li style="--c:${x.color}">${lineLink(x)}</li>`).join('')}</ul>` : ''}
    </section>`;
  const jsonld = [crumbsLd(crumbs, path_)];
  const attrs = `id="lp-main" data-page="line" data-rr="${l.rr}" data-route="${esc(l.ids.join(','))}" data-name="${esc(l.baseName)}" data-history="${esc(hist)}" `;
  let names = '';
  if (['mnr', 'lirr', 'metra'].includes(l.rr)) {
    const m = {};
    for (const s of l.all) for (const k of s.kids) m[k] = s.name;
    names = `<script type="application/json" id="lp-stop-names">${JSON.stringify(m).replace(/</g, '\\u003c')}</script>\n`;
  }
  write(`lines/${l.slug}/index.html`, page(T, { path: path_, title, description: desc, h1: l.name, lead: '',
    map: { rr: l.rr, lines: [{ color: l.color, paths: linePaths(l) }], stops: l.all.map((x) => { const st = l.rr === 'mbta' && stations.get(x.id); return [r5(x.lat), r5(x.lon), x.name, st ? `/stations/${st.slug}/` : '']; }) }, color: l.color, crumbs, jsonld, body, actions, mainAttrs: attrs, script: names + widget }));
}

/* Lines index */
{
  const groups = RAIL_ORDER.map((rr) => [rr, lines.filter((l) => l.rr === rr)]).filter((g) => g[1].length);
  const body = `    <section class="lp-card wide" aria-label="Railroads">
      <ul class="lp-jump">${groups.map(([rr]) => `<li><a href="#${rr}">${esc(RR[rr].label)}</a></li>`).join('')}</ul>
    </section>
${groups.map(([rr, ls]) => `    <section class="lp-card wide" id="${rr}" aria-labelledby="${rr}-title" style="--line-color:var(--rail-${rr})">
      <h2 id="${rr}-title">${esc(RR[rr].label)}</h2>
      <p class="lp-sub">${ls.length} ${rr === 'amtrak' || rr === 'via' ? 'routes' : 'lines'}</p>
      <ul class="lp-index">${ls.slice().sort((a, b) => a.name.localeCompare(b.name)).map((l) => `<li style="--c:${l.color}">${lineLink(l)}<small>${l.all.length} stations</small></li>`).join('')}</ul>
    </section>`).join('\n')}`;
  const crumbs = [home, ['Lines', '/lines/']];
  const jsonld = [crumbsLd(crumbs, '/lines/')];
  write('lines/index.html', page(T, { path: '/lines/', title: 'Train Line Tracker: Live Maps, Delays and On-Time Stats', h1: 'Train Lines',
    description: `Follow trains on the RailroadRadar live map, with delays, on-time history and station lists for ${lines.length} lines on MBTA Commuter Rail, Amtrak, Metro-North, LIRR, NJ Transit, MARC, Metra, CTrail and VIA Rail.`,
    lead: `Pick a line to see its trains live, current alerts and every station in order. ${lines.length} lines across ${groups.length} railroads.`, color: '#07093e', crumbs, jsonld, body,
    actions: '<a class="rr-btn" href="/map/">Open the Live Map</a><a class="rr-btn secondary" href="/stations/">All Stations</a>' }));
}

/* Station pages */
for (const st of stations.values()) {
  const path_ = `/stations/${st.slug}/`;
  const crumbs = [home, ['Stations', '/stations/'], [st.name, path_]];
  const mbtaLines = st.lines.filter((l) => l.rr === 'mbta');
  const others = st.lines.filter((l) => l.rr !== 'mbta');
  const lineNames = mbtaLines.map((l) => l.name);
  const zone = /^CR-zone-(.+)$/.exec(st.zone);
  const stName = /\bStation$/.test(st.name) ? st.name : st.name + ' Station';
  const title = `${stName} Train Tracker: Live Departures and Delays`;
  const desc = `Live departures and delays at ${stName} on the ${listJoin(lineNames)}${others.length ? ', plus ' + listJoin(others.map((l) => l.name)) : ''}, with the RailroadRadar live map and MyTrips to log your rides.`;
  const lead = `${esc(st.name)} is an MBTA Commuter Rail station${st.town ? ' in ' + esc(st.town) + ', MA' : ''}, served by the ${esc(listJoin(lineNames))}${others.length ? ' and by ' + esc(listJoin(others.map((l) => l.name))) : ''}.`;
  const facts = [['Railroad', others.length ? 'MBTA Commuter Rail and ' + listJoin([...new Set(others.map((l) => RR[l.rr].short))]) : 'MBTA Commuter Rail']];
  if (zone) facts.push(['Fare Zone', 'Zone ' + zone[1]]);
  if (st.access === '1') facts.push(['Accessibility', 'Accessible']);
  else if (st.access === '2') facts.push(['Accessibility', 'Not Accessible']);
  if (st.address) facts.push(['Address', st.address]);
  const linesHtml = st.lines.map((l) => {
    const idx = l.all.findIndex((s) => (l.rr === 'mbta' ? s.id === st.id : st.other[l.slug].id === s.id));
    const prev = idx > 0 ? l.all[idx - 1] : null, next = idx >= 0 && idx < l.all.length - 1 ? l.all[idx + 1] : null;
    return `<li style="--c:${l.color}">${lineLink(l)} <small>${esc(RR[l.rr].short)}</small></li>`;
  }).join('');
  const nearby = [];
  for (const l of mbtaLines) {
    const i = l.all.findIndex((s) => s.id === st.id);
    [l.all[i - 1], l.all[i + 1]].forEach((s) => { const x = s && stations.get(s.id); if (x && x !== st && !nearby.includes(x)) nearby.push(x); });
  }
  const tt = mbtaLines.find((l) => l.key !== 'CapeFlyer');
  const amtrakCodes = others.filter((l) => l.rr === 'amtrak').map((l) => st.other[l.slug].code || st.other[l.slug].id);
  const body = `    <section class="lp-card" id="departures" aria-labelledby="dep-title">
      <h2 id="dep-title">Upcoming Departures</h2>
      <p class="lp-sub">The next Commuter Rail trains from ${esc(st.name)}, with live predictions when MBTA has them.</p>
      <div id="lp-departures"><p class="lp-msg">Loading departures...</p></div>
    </section>
    <section class="lp-card" aria-labelledby="lines-title">
      <h2 id="lines-title">Lines at ${esc(st.name)}</h2>
      <ul class="lp-links">${linesHtml}</ul>
      ${nearby.length ? `<h3>Next Stations</h3><ul class="lp-links">${nearby.map((x) => `<li><a href="/stations/${x.slug}/">${esc(x.name)}</a></li>`).join('')}</ul>` : ''}
    </section>
    ${amtrakCodes.length ? `<section class="lp-card wide" id="amtrak" aria-labelledby="amtrak-title" hidden>
      <h2 id="amtrak-title">Amtrak Trains Due</h2>
      <p class="lp-sub">Amtrak trains that have not reached ${esc(st.name)} yet, from Amtrak's live train feed.</p>
      <div id="lp-amtrak"></div>
    </section>` : ''}
    <section class="lp-card wide" aria-labelledby="facts-title">
      <h2 id="facts-title">About ${esc(stName)}</h2>
      <dl class="lp-facts">${facts.map((f) => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>
      ${officialHtml([{ url: `https://www.mbta.com/stops/${encodeURIComponent(st.id)}`, label: 'Official MBTA Station Page' }, ...[...new Set(others.map((l) => l.rr))].map((rr) => officialLink(rr))])}
    </section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'TrainStation', name: st.name + ' Station', url: SITE + path_, geo: { '@type': 'GeoCoordinates', latitude: st.lat, longitude: st.lon } };
  if (st.address) {
    const m = /^(.*),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})$/.exec(st.address);
    ld.address = m ? { '@type': 'PostalAddress', streetAddress: m[1], addressLocality: m[2], addressRegion: m[3], postalCode: m[4], addressCountry: 'US' } : st.address;
  }
  const attrs = `id="lp-main" data-page="station" data-rr="mbta" data-stop="${esc(st.id)}" data-name="${esc(st.name)}" data-amtrak="${esc(amtrakCodes.join(','))}" data-route="${esc(mbtaLines.flatMap((l) => l.ids).join(','))}" data-amtrak-lines="${esc(others.filter((l) => l.rr === 'amtrak').map((l) => l.baseName).join('|'))}" `;
  const box = [st.lat - 0.35, st.lon - 0.5, st.lat + 0.35, st.lon + 0.5];
  const near = new Map();
  for (const l of mbtaLines) for (const x of l.all) { const y = stations.get(x.id); if (y && y !== st) near.set(y.id, [r5(y.lat), r5(y.lon), y.name, `/stations/${y.slug}/`]); }
  const stationMap = { rr: 'mbta', center: [r5(st.lat), r5(st.lon)], zoom: 13, here: [r5(st.lat), r5(st.lon), stName],
    lines: [...mbtaLines, ...others.filter((l) => l.rr === 'amtrak')].map((l) => ({ color: l.color, paths: linePaths(l, l.rr === 'mbta' ? null : box) })), stops: [...near.values()] };
  const actions = `<a class="rr-btn" href="/map/">Open the Live Map</a>` + (tt ? `<a class="rr-btn secondary" href="/timetables/?rr=mbta&amp;line=${encodeURIComponent(tt.key)}">Timetable</a>` : '');
  write(`stations/${st.slug}/index.html`, page(T, { path: path_, title, description: desc, h1: stName, map: stationMap, lead: '', color: mbtaLines[0].color, crumbs,
    jsonld: [crumbsLd(crumbs, path_), ld], body, actions, mainAttrs: attrs, script: widget }));
}

/* Stations index */
{
  const all = [...stations.values()].sort((a, b) => a.name.localeCompare(b.name));
  const letters = [...new Set(all.map((s) => s.name[0].toUpperCase()))];
  const body = `    <section class="lp-card wide" aria-label="Jump to a Letter">
      <ul class="lp-jump">${letters.map((c) => `<li><a href="#letter-${c.toLowerCase()}">${c}</a></li>`).join('')}</ul>
    </section>
${letters.map((c) => `    <section class="lp-card wide" id="letter-${c.toLowerCase()}" aria-labelledby="letter-${c.toLowerCase()}-title">
      <h2 id="letter-${c.toLowerCase()}-title">${c}</h2>
      <ul class="lp-index lp-az">${all.filter((s) => s.name[0].toUpperCase() === c).map((s) => `<li style="--c:${s.lines[0].color}"><a href="/stations/${s.slug}/">${esc(s.name)}</a><small>${esc(s.lines.filter((l) => l.rr === 'mbta').map((l) => l.name.replace(/ Line$/, '')).join(', '))}</small></li>`).join('')}</ul>
    </section>`).join('\n')}`;
  const crumbs = [home, ['Stations', '/stations/']];
  write('stations/index.html', page(T, { path: '/stations/', title: 'MBTA Commuter Rail Station Tracker: Live Departures and Delays', h1: 'MBTA Commuter Rail Stations',
    description: `Live departures, delays and lines on RailroadRadar for all ${all.length} MBTA Commuter Rail stations, from South Station and North Station to Providence, Worcester and Newburyport.`,
    lead: `All ${all.length} MBTA Commuter Rail stations, with live departures and the lines that stop at each one.`, color: '#9d1c80', crumbs, jsonld: [crumbsLd(crumbs, '/stations/')], body,
    actions: '<a class="rr-btn" href="/map/">Open the Live Map</a><a class="rr-btn secondary" href="/lines/">All Lines</a>' }));
}

/* sitemap.xml: everything between the markers is rewritten on each run. */
{
  const f = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(f, 'utf8');
  const START = '  <!-- Line and station pages: written by tools/seo-pages.mjs -->', END = '  <!-- End of line and station pages -->';
  const a = xml.indexOf(START), b = xml.indexOf(END);
  if (a >= 0 && b > a) xml = xml.slice(0, a) + xml.slice(b + END.length + 1);
  const urls = OUT.map((rel) => '/' + rel.replace(/index\.html$/, '')).sort((x, y) => (x.split('/').length - y.split('/').length) || x.localeCompare(y));
  const block = [START, ...urls.map((u) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${u.split('/').length <= 3 ? 'weekly' : 'daily'}</changefreq>\n    <priority>${u.split('/').length <= 3 ? '0.8' : '0.6'}</priority>\n  </url>`), END].join('\n') + '\n';
  xml = xml.replace('</urlset>', block + '</urlset>');
  fs.writeFileSync(f, xml);
}
if (args.includes('--print')) for (const l of lines) console.log(`\n${l.name} [${l.slug}] ${l.all.length}: ${l.main.map((s) => s.name).join(' > ')}` + l.branches.map((b) => `\n   + ${b.from ? b.from.name : '(start)'} [${b.stops.map((s) => s.name).join(' > ')}] ${b.to ? b.to.name : '(end)'}`).join(''));
console.log(coverage.join('\n'));
console.log(`Wrote ${OUT.length} pages: ${lines.length} lines, ${stations.size} stations, 2 indexes.`);
