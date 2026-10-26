// Fails if any site script has a syntax error, any ?v= cache-buster is out of date, a site-index.json snippet is no longer on its page, or the home page route count no longer matches assets/shapes. Reads only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { siteDir } from '../site-dir.js';

const SKIP_DIRS = new Set(['tests', 'node_modules']);
const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript', 'module']);

function walk(dir, out = [], seen = new Set()) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out, seen);
    else {
      // mytrips/index.html is a symlink to index.html; check each real file once.
      const real = fs.realpathSync(p);
      if (!seen.has(real)) { seen.add(real); out.push(p); }
    }
  }
  return out;
}

const rel = (p) => path.relative(siteDir, p);
const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// Padding with newlines makes reported line numbers match the HTML file.
function parseError(src, { module, lineOffset = 0 }) {
  const padded = '\n'.repeat(lineOffset) + src;
  if (module) {
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: padded, encoding: 'utf8' });
    if (r.status === 0) return null;
    const lines = r.stderr.split('\n');
    const at = (lines[0].match(/:(\d+)$/) || [])[1];
    return `line ${at}: ${lines.find((l) => /Error/.test(l)) || r.stderr.trim()}`;
  }
  try {
    new vm.Script(padded, { filename: 'x' });
    return null;
  } catch (e) {
    const at = (String(e.stack).match(/^x:(\d+)/) || [])[1];
    return `line ${at}: ${e.name}: ${e.message}`;
  }
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

// Walks the HTML in order so that <script> tags inside <!-- comments --> are skipped.
function inlineScripts(html) {
  const out = [];
  const re = /<!--|<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '<!--') {
      const end = html.indexOf('-->', re.lastIndex);
      re.lastIndex = end < 0 ? html.length : end + 3;
      continue;
    }
    const start = re.lastIndex;
    const close = html.slice(start).search(/<\/script\s*>/i);
    const end = close < 0 ? html.length : start + close;
    re.lastIndex = end;
    out.push({ attrs: m[1], src: html.slice(start, end), line: lineAt(html, start) - 1 });
  }
  return out;
}

const hashCache = new Map();
function shortHash(file) {
  if (!hashCache.has(file)) hashCache.set(file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10));
  return hashCache.get(file);
}

function checkVersions(file, text) {
  const re = /([A-Za-z0-9_.\/:-]+)\?v=([A-Za-z0-9_-]+)/g;
  let m;
  while ((m = re.exec(text))) {
    let ref = m[1];
    const value = m[2];
    const abs = ref.match(/^(?:https?:)?\/\/([^/]+)(\/.*)$/);
    if (abs) {
      if (!/(^|\.)railroadradar\.com$/.test(abs[1])) continue;
      ref = abs[2];
    }
    const target = ref.startsWith('/') ? path.join(siteDir, ref) : path.join(path.dirname(file), ref);
    const where = `${rel(file)}:${lineAt(text, m.index)}`;
    // Images use hand-bumped counters like ?v=3; scripts, styles and anything already hashed must match.
    const hashed = /^[0-9a-f]{10}$/.test(value) || /\.(js|css)$/.test(ref);
    if (!hashed) continue;
    if (!fs.existsSync(target)) { fail(where, `${ref}?v=${value} points to a missing file`); continue; }
    const want = shortHash(target);
    if (value !== want) fail(where, `${ref}?v=${value} should be ?v=${want}`);
  }
}

const files = walk(siteDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));
const htmlFiles = files.filter((f) => f.endsWith('.html'));

const moduleSrcs = new Set();
for (const file of htmlFiles) {
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>/gi)) {
    const src = attr(m[1], 'src');
    if (src && (attr(m[1], 'type') || '').toLowerCase() === 'module') {
      moduleSrcs.add(path.normalize(src.startsWith('/') ? path.join(siteDir, src.split('?')[0]) : path.join(path.dirname(file), src.split('?')[0])));
    }
  }
}

let scripts = 0;
for (const file of jsFiles) {
  const text = fs.readFileSync(file, 'utf8');
  // Worker files are Cloudflare module workers.
  const module = rel(file).startsWith('workers' + path.sep) || moduleSrcs.has(path.normalize(file));
  const err = parseError(text, { module });
  if (err) fail(rel(file), err);
  checkVersions(file, text);
}
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const s of inlineScripts(html)) {
    const type = (attr(s.attrs, 'type') || '').trim().toLowerCase();
    if (!JS_TYPES.has(type) || attr(s.attrs, 'src') !== null || !s.src.trim()) continue;
    scripts++;
    const err = parseError(s.src, { module: type === 'module', lineOffset: s.line });
    if (err) fail(`${rel(file)} inline script`, err);
  }
  checkVersions(file, html);
}

// Ask quotes assets/data/site-index.json word for word, so every snippet must still be on the page it cites.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', middot: '·', copy: '©', times: '×', hellip: '...' };
function plainText(s) {
  return String(s)
    .replace(/<meta\s+name="description"\s+content="([^"]*)"[^>]*>/gi, ' $1 ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/\\(['"])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:)])/g, '$1');
}
function checkSiteIndex() {
  const file = path.join(siteDir, 'assets/data/site-index.json');
  if (!fs.existsSync(file)) return 0;
  const where = rel(file);
  let index;
  try { index = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(where, e.message); return 0; }
  const pages = index.pages || [];
  const ids = new Set(pages.map((p) => p.id));
  const textOf = new Map();
  const pageText = (f) => {
    if (!textOf.has(f)) textOf.set(f, plainText(fs.readFileSync(path.join(siteDir, f), 'utf8')));
    return textOf.get(f);
  };
  const pageFile = (url) => {
    const p = url.split(/[?#]/)[0];
    return p.endsWith('/') ? p.slice(1) + 'index.html' : p.slice(1);
  };
  const hasId = (f, id) => new RegExp(`\\bid=["']${id}["']`).test(fs.readFileSync(path.join(siteDir, f), 'utf8'));
  let snippets = 0;
  for (const p of pages) {
    const at = `${where} ${p.id || '(no id)'}`;
    if (!p.id || !p.title || !p.url || !Array.isArray(p.k) || !Array.isArray(p.s) || !p.s.length) { fail(at, 'needs id, title, url, k and s'); continue; }
    const target = pageFile(p.url);
    if (!fs.existsSync(path.join(siteDir, target))) { fail(at, `${p.url} has no ${target}`); continue; }
    const anchor = p.url.split('#')[1];
    if (anchor && !hasId(target, anchor)) fail(at, `${target} has no id="${anchor}"`);
    if (p.click && !hasId('map/index.html', p.click)) fail(at, `map/index.html has no id="${p.click}"`);
    for (const r of p.rel || []) if (!ids.has(r)) fail(at, `rel "${r}" is not an entry`);
    const srcs = p.src && p.src.length ? p.src : [target];
    for (const f of srcs) if (!fs.existsSync(path.join(siteDir, f))) fail(at, `src ${f} is missing`);
    for (const sn of p.s) {
      snippets++;
      if (/[\u2013\u2014\u2018\u2019\u201c\u201d]/.test(sn.t)) fail(at, `use straight quotes and no dashes: "${sn.t}"`);
      if (sn.a && !hasId(target, sn.a)) fail(at, `${target} has no id="${sn.a}"`);
      const want = plainText(sn.t);
      if (!srcs.some((f) => fs.existsSync(path.join(siteDir, f)) && pageText(f).includes(want))) fail(at, `snippet is not on ${srcs.join(' or ')}: "${sn.t}"`);
    }
  }
  return snippets;
}
const indexSnippets = checkSiteIndex();

// The home page's By the Numbers route count is typed in, so it must match the route shapes the map draws.
function checkHomeRouteCount() {
  const home = path.join(siteDir, 'index.html');
  const dir = path.join(siteDir, 'assets/shapes');
  if (!fs.existsSync(home) || !fs.existsSync(dir)) return;
  const m = fs.readFileSync(home, 'utf8').match(/data-count="(\d+)" data-stat="routes"/);
  if (!m) return;
  let routes = 0;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    try { routes += (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).routes || []).length; } catch (e) { fail(rel(path.join(dir, f)), e.message); }
  }
  if (Number(m[1]) !== routes) fail('index.html', `By the Numbers says ${m[1]} routes but assets/shapes has ${routes}; update data-count and the text`);
}
checkHomeRouteCount();

console.log(`Checked ${jsFiles.length} .js files, ${scripts} inline scripts in ${htmlFiles.length} .html files under ${siteDir}`);
if (indexSnippets) console.log(`Checked ${indexSnippets} site-index.json snippets against their pages`);
if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('No problems found.');
