// Screenshots of the 24-Hour Train Replay with real replay data at 390 and 1280 wide.
//   REPLAY_BASE unset: local site with fixture feeds, real /api/replay/hour.  REPLAY_BASE=https://railroadradar.com: live.
//   REPLAY_OUT: output folder.  REPLAY_SAMPLE=1: use ?replaySample=1 (no network).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { routeNetwork } from './network.js';

const LIVE = process.env.REPLAY_BASE || '';
const PORT = 8215, BASE = LIVE || `http://127.0.0.1:${PORT}`, OUT = process.env.REPLAY_OUT || '/workspace/replay/local';
const QS = process.env.REPLAY_SAMPLE ? '?replaySample=1' : '';
mkdirSync(OUT, { recursive: true });
const server = LIVE ? null : spawn('node', ['server.js'], { cwd: new URL('.', import.meta.url).pathname, env: { ...process.env, SMOKE_PORT: String(PORT) }, stdio: 'ignore' });
if (server) await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const errors = [];
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
try {
  for (const [w, h, tag] of [[390, 844, '390'], [1280, 800, '1280']]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === '390' ? 2 : 1, serviceWorkers: 'block', timezoneId: 'America/New_York', isMobile: tag === '390', hasTouch: tag === '390' });
    if (!LIVE) {
      await routeNetwork(context, BASE);
      await context.route('https://railroadradar-replay.railroadradar.workers.dev/**', (r) => r.continue());
    }
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
    page.on('response', (r) => { if (/replay/.test(r.url()) && r.status() >= 400) errors.push(`${tag}: ${r.status()} ${r.url()}`); });
    await page.goto(`${BASE}/map/${QS}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.rrMainMap && window.rrReplay && document.querySelector('.rr-replay-open'), null, { timeout: 60_000 });
    await page.waitForTimeout(2500);
    for (const name of ['Decline', 'Reject All', 'Close']) {
      const b = page.getByRole('button', { name, exact: true });
      if (await b.count()) await b.first().click().catch(() => {});
    }
    await page.evaluate(() => { window.rrMainMap.setView([40.86, -73.75], 9, { animate: false }); });
    await page.waitForTimeout(600);
    await page.click('.rr-replay-open');
    if (process.env.REPLAY_BACK_MIN) {
      const t = new Date(Date.now() - Number(process.env.REPLAY_BACK_MIN) * 60000).toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
      await page.fill('.rr-replay-jump-in', t);
      await page.dispatchEvent('.rr-replay-jump-in', 'change');
    }
    await page.waitForFunction(() => window.rrReplay.trains().length > 0, null, { timeout: 30_000 }).catch(() => errors.push(`${tag}: no replay trains`));
    await page.waitForTimeout(800);
    await shot(page, `live-${tag}-1-controls`);
    await page.click('.rr-replay-rate[data-rate="10"]');
    await page.click('.rr-replay-play');
    await page.waitForTimeout(3000);
    await shot(page, `live-${tag}-2-playing`);
    await page.evaluate(() => { window.rrMainMap.setView([40.80, -73.93], 12, { animate: false }); });
    await page.waitForTimeout(2000);
    await shot(page, `live-${tag}-2b-playing-zoomed`);
    await page.click('.rr-replay-play');                       // pause for steady popups
    for (const kind of ['amtrak', 'derived']) {
      // Widen to the Northeast so every railroad loads, then try trains until one shows a moving speed.
      await page.evaluate(() => { window.rrMainMap.setView([41.3, -73.2], 7, { animate: false }); });
      await page.waitForTimeout(2500);
      const cands = await page.evaluate((kind) => window.rrReplay.trains()
        .filter((t) => kind === 'amtrak' ? t.rr === 'amtrak' && t.rec[2] > 20 : (t.rr === 'lirr' || t.rr === 'mnr' || t.rr === 'mbta') && t.rec[2] == null && t.rec[4] != null && t.rec[4] < 120)
        .sort((x, y) => (kind === 'amtrak' ? (/acela/i.test(y.route) - /acela/i.test(x.route)) : (x.rr === 'lirr' ? -1 : 1)))
        .slice(0, 30).map((t) => ({ id: t.id, lat: t.lat, lon: t.lon })), kind);
      let done = false;
      for (const c of cands) {
        await page.evaluate((c) => { window.rrMainMap.closePopup(); window.rrMainMap.setView([c.lat, c.lon], 11, { animate: false }); }, c);
        await page.waitForTimeout(1000);
        const ok = await page.evaluate((id) => { const m = window.rrReplay.markers()[id]; if (m) { m.openPopup(); return true; } return false; }, c.id);
        if (!ok) continue;
        await page.waitForTimeout(800);
        const txt = await page.evaluate(() => (document.querySelector('.rr-replay-popup') || {}).innerText || '');
        const mph = parseInt((txt.match(/(\d+)\s*mph/i) || [])[1] || '0', 10);
        if (mph < 10) continue;
        await page.waitForTimeout(700);
        await shot(page, `live-${tag}-3-popup-${kind}`);
        console.log(tag, kind, c.id, JSON.stringify(txt.replace(/\s+/g, ' ').slice(0, 200)));
        done = true; break;
      }
      if (!done) errors.push(`${tag}: no moving ${kind} train`);
      await page.evaluate(() => { window.rrMainMap.closePopup(); });
    }
    const info = await page.evaluate(() => ({ markers: Object.keys(window.rrReplay.markers()).length, trains: window.rrReplay.trains().length, loaded: window.rrReplay.loaded(), status: (document.querySelector('.rr-replay-status') || {}).textContent }));
    console.log(tag, JSON.stringify(info));
    await context.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
if (errors.length) console.log('errors:', errors.join('\n'));
