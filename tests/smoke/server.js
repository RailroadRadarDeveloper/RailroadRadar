// Serves SITE_DIR the way GitHub Pages does: /dir/ serves dir/index.html, /page serves page.html, misses get 404.html.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { siteDir } from '../site-dir.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.xsl': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.webp': 'image/webp'
};

const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(siteDir, path.normalize(decodeURIComponent(url.pathname)));
  if (!file.startsWith(siteDir)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
    if (isFile(path.join(file, 'index.html'))) { send(res, 200, path.join(file, 'index.html')); return; }
  }
  if (isFile(file)) { send(res, 200, file); return; }
  if (isFile(file + '.html')) { send(res, 200, file + '.html'); return; }
  send(res, 404, path.join(siteDir, '404.html'));
}).listen(Number(process.env.SMOKE_PORT || 8203), '127.0.0.1');
