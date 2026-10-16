// Fails if any site script has a syntax error or any ?v= cache-buster is out of date. Reads only.
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

console.log(`Checked ${jsFiles.length} .js files, ${scripts} inline scripts in ${htmlFiles.length} .html files under ${siteDir}`);
if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('No problems found.');
