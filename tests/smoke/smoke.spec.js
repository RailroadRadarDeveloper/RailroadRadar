import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { siteDir } from '../site-dir.js';
import { RECORD, fixtures, misses, routeNetwork, saveFixtures } from './network.js';
import knownFailures from './known-failures.js';

function pageUrls(dir = siteDir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'tests' || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (fs.statSync(p).isDirectory()) pageUrls(p, out);
    else if (ent.name.endsWith('.html')) out.push('/' + path.relative(siteDir, p).split(path.sep).join('/').replace(/(^|\/)index\.html$/, '$1'));
  }
  return out.sort();
}

let problems = [];
function watch(page, origin) {
  problems = [];
  const visited = [];
  page.on('pageerror', (e) => {
    const at = String(e.stack || '').split('\n').find((l) => /^\s+at /.test(l));
    problems.push(`uncaught ${e.name}: ${e.message}${at ? ` (${at.trim().replace(origin, '')})` : ''}`);
  });
  page.on('console', (m) => {
    const where = m.location();
    if (m.type() !== 'error' || (where.url && !where.url.startsWith(origin))) return;
    problems.push(`console.error: ${m.text().slice(0, 300)} (${where.url.replace(origin, '')}:${where.lineNumber + 1})`);
  });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname); });
  return { visited };
}

// Known failures are reported on the test instead of failing it.
function realProblems(problems, url) {
  const real = [];
  for (const p of problems) {
    const known = knownFailures.find((k) => (!k.page || k.page === url) && k.match.test(p));
    if (known) test.info().annotations.push({ type: 'known failure', description: `${p} [${known.why}]` });
    else real.push(p);
  }
  return real;
}

test.beforeEach(async ({ context, baseURL }) => {
  await routeNetwork(context, baseURL);
  if (!RECORD) await context.clock.install({ time: new Date(fixtures.recordedAt) });
  // Every railroad on, and the first-visit picker and cookie banner already answered.
  await context.addInitScript(() => {
    localStorage.setItem('rr_map_railroads', JSON.stringify({ mbta: true, amtrak: true, mnr: true, lirr: true, metra: true, njt: true, ctrail: true, marc: true }));
    localStorage.setItem('rr_cookie_prefs', JSON.stringify({ decided: true, clarity: false, preferences: true }));
  });
});

test.afterEach(({}, info) => {
  if (info.status !== info.expectedStatus && problems.length) console.log(`Errors on the page:\n  ${problems.join('\n  ')}`);
});

test.afterAll(() => {
  if (RECORD) saveFixtures();
  else if (misses.size) console.log(`Worker requests with no recording (answered 404):\n  ${[...misses].sort().join('\n  ')}`);
});

for (const url of pageUrls()) {
  test(`page ${url}`, async ({ page, baseURL }) => {
    const { visited } = watch(page, baseURL);
    await page.goto(url, { waitUntil: 'load' });
    // The boot failsafe on the map pages decides 3 seconds after load.
    await page.waitForTimeout(5000);
    await page.waitForLoadState('load');

    if (url !== '/unavailable.html') expect.soft(visited, 'redirected to the unavailable page').not.toContain('/unavailable.html');
    const boot = await page.evaluate(() => window.__rrBootFailsafe ? window.__rrBootReady : null);
    if (boot !== null) expect.soft(boot, 'page never marked itself booted').toBe(true);

    const width = page.viewportSize().width;
    if (width < 600) {
      const overflow = await page.evaluate((vw) => {
        if (document.documentElement.scrollWidth <= vw) return null;
        const wide = [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== 'fixed')
          .slice(0, 5)
          .map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
        return { scrollWidth: document.documentElement.scrollWidth, wide };
      }, width);
      expect.soft(overflow, 'page scrolls sideways').toBeNull();
    }

    expect(realProblems(problems, url)).toEqual([]);
  });
}

test('map shows trains and popups for each railroad', async ({ page, baseURL }, info) => {
  watch(page, baseURL);
  await page.goto('/map/');
  await page.waitForFunction(() => window.rrMainMap && typeof window.rrCollectLiveTrainRows === 'function', null, { timeout: 30_000 });

  const countTrains = () => page.evaluate(() => {
    const out = {};
    for (const r of window.rrCollectLiveTrainRows()) {
      const m = r.markerMap && r.markerMap[r.id];
      if (m && window.rrMainMap.hasLayer(m)) out[r.agency] = (out[r.agency] || 0) + 1;
    }
    return out;
  });

  const expected = Object.keys(fixtures.expectedTrains);
  let counts;
  if (RECORD) {
    await page.waitForTimeout(30_000);
    counts = await countTrains();
    if (info.project.name === 'desktop') fixtures.expectedTrains = counts;
  } else {
    await expect.poll(async () => {
      counts = await countTrains();
      return expected.filter((a) => !counts[a]);
    }, { message: 'railroads with no trains on the map', timeout: 45_000 }).toEqual([]);
  }
  console.log(`${info.project.name} trains: ${JSON.stringify(counts)}`);
  expect(Object.keys(counts).length, 'no trains on the map at all').toBeGreaterThan(0);

  for (const agency of Object.keys(counts).sort()) {
    await page.evaluate((a) => {
      window.rrMainMap.closePopup();
      const r = window.rrCollectLiveTrainRows().find((x) => x.agency === a && x.markerMap[x.id] && window.rrMainMap.hasLayer(x.markerMap[x.id]));
      r.markerMap[r.id].fire('click');
    }, agency);
    const popup = page.locator('.leaflet-popup-content').first();
    await expect(popup, `${agency} popup`).toBeVisible();
    await expect.poll(async () => (await popup.innerText()).trim().length, { message: `${agency} popup is empty` }).toBeGreaterThan(0);
    // Let schedule and prediction lookups behind the popup finish.
    await page.waitForTimeout(1500);
    console.log(`${info.project.name} ${agency} popup: ${(await popup.innerText()).replace(/\s+/g, ' ').trim().slice(0, 160)}`);
  }

  expect(realProblems(problems, '/map/')).toEqual([]);
});

test('timetables grid and trip planner', async ({ page, baseURL }) => {
  watch(page, baseURL);
  await page.goto('/timetables/?rr=mbta&line=CR-Haverhill&date=2026-10-15');
  const grid = page.locator('#tt-panel-table .tt-grid');
  await expect(grid).toBeVisible();
  expect(await grid.locator('thead th').count(), 'train columns').toBeGreaterThan(5);
  expect(await grid.locator('tbody tr').count(), 'station rows').toBeGreaterThan(5);
  await page.click('#tt-tab-outbound');
  await expect(page).toHaveURL(/dir=outbound/);
  await expect(page.locator('#tt-title')).toContainText('Haverhill Line');

  // The recording has Commuter Rail only, so the subway is one Orange Line route with two trips from North Station
  // to Back Bay: one too soon after Train 266 arrives at 6:41 PM to change, and one that leaves time to change.
  const station = (id, name, parent) => ({ type: 'stop', id, attributes: { name }, relationships: { parent_station: { data: parent ? { type: 'stop', id: parent } : null } } });
  const stop = (trip, id, seq, time) => ({ type: 'schedule', id: trip + '-' + seq, attributes: { arrival_time: time, departure_time: time, stop_sequence: seq, pickup_type: 0, drop_off_type: 0, direction_id: 0 },
    relationships: { trip: { data: { type: 'trip', id: trip } }, stop: { data: { type: 'stop', id } }, route: { data: { type: 'route', id: 'Orange' } } } });
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  await page.route((u) => decodeURIComponent(u.href).includes('/api/mbta/routes?filter[type]=0,1'), (r) => json(r, {
    data: [{ type: 'route', id: 'Orange', attributes: { long_name: 'Orange Line', color: 'ED8B00', type: 1 } }]
  }));
  await page.route((u) => decodeURIComponent(u.href).includes('/api/mbta/stops?filter[route_type]=0,1,2'), (r) => json(r, {
    data: [station('WR-0329-02', 'Haverhill', 'place-WR-0329'), station('BNT-0000', 'North Station', 'place-north'), station('70014', 'Back Bay', 'place-bbsta')]
  }));
  await page.route((u) => decodeURIComponent(u.href).includes('filter[route]=Orange&'), (r) => json(r, {
    data: [stop('o1', '70026', 1, '2026-10-15T18:45:00-04:00'), stop('o1', '70014', 2, '2026-10-15T18:56:00-04:00'),
      stop('o2', '70026', 1, '2026-10-15T18:55:00-04:00'), stop('o2', '70014', 2, '2026-10-15T19:06:00-04:00')],
    included: [{ type: 'trip', id: 'o1', attributes: { headsign: 'Forest Hills', name: '' } }, { type: 'trip', id: 'o2', attributes: { headsign: 'Forest Hills', name: '' } },
      station('70026', 'North Station', 'place-north'), station('70014', 'Back Bay', 'place-bbsta')]
  }));

  await page.goto('/timetables/?view=plan&rr=mbta&from=place-WR-0329&to=place-north&date=2026-10-15&after=17:00');
  const first = page.locator('.tp-option').first();
  await expect(first).toContainText('Haverhill Line');
  await expect(first).toContainText('Train 266 to North Station');
  await expect(first).toContainText('5:30 PM');

  await page.selectOption('#tp-to', 'place-bbsta');
  await expect(page).toHaveURL(/to=place-bbsta/);
  const trip = page.locator('.tp-option').first();
  await expect(trip).toContainText('Orange Line');
  await expect(trip).toContainText('Transfer at North Station, 14 Min Wait');
  await expect(trip.locator('.tp-times')).toContainText('7:06 PM');

  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'page scrolls sideways').toBeLessThanOrEqual(0);
  expect(realProblems(problems, '/timetables/')).toEqual([]);
});
