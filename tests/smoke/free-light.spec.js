import { test, expect } from '@playwright/test';
import { routeNetwork } from './network.js';

const LIGHT_STYLE = 'ckyq285h5219a14mpql9jt2r7';

test.beforeEach(async ({ context, baseURL }) => {
  await routeNetwork(context, baseURL);
  await context.addInitScript(() => {
    localStorage.setItem('rr_map_railroads', JSON.stringify({ mbta: true, amtrak: true, mnr: true, lirr: true, njt: true, ctrail: true, marc: true }));
    localStorage.setItem('rr_cookie_prefs', JSON.stringify({ decided: true, clarity: false, preferences: true }));
    localStorage.setItem('rr_discord', JSON.stringify({ s: 'done', at: Date.now() }));
    localStorage.setItem('rr_mapTheme', 'light');
  });
});

function track(page, baseURL) {
  const urls = [];
  const problems = [];
  page.on('request', (req) => urls.push(req.url()));
  page.on('pageerror', (err) => problems.push(`uncaught ${err.message}`));
  page.on('console', (msg) => {
    const where = msg.location();
    if (msg.type() !== 'error' || (where.url && baseURL && !where.url.startsWith(baseURL))) return;
    problems.push(`console.error: ${msg.text().slice(0, 300)}`);
  });
  return { urls, problems };
}

async function painted(page, root) {
  await page.waitForFunction((sel) => {
    const scope = sel ? document.querySelector(sel) : document;
    const canvas = scope && scope.querySelector('.maplibregl-canvas');
    if (!canvas || canvas.width < 20 || canvas.height < 20) return false;
    const sample = document.createElement('canvas');
    sample.width = 8;
    sample.height = 8;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 8, 8);
    const data = ctx.getImageData(0, 0, 8, 8).data;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 20) continue;
      if (data[i] + data[i + 1] + data[i + 2] > 30) colored++;
    }
    return colored >= 4;
  }, root || null, { timeout: 30_000 });
}

test('main map uses the free light tiles', async ({ page, baseURL }, info) => {
  const seen = track(page, baseURL);
  await page.goto('/map/');
  await page.waitForRequest((req) => req.url().includes('tiles.openfreemap.org'), { timeout: 30_000 });
  await painted(page, '#map');
  const credit = page.locator('.leaflet-control-attribution');
  await expect(credit).toContainText('OpenFreeMap');
  await expect(credit).toContainText('OpenStreetMap');
  expect(seen.urls.filter((url) => url.includes('/api/mapbox/'))).toEqual([]);
  expect(seen.problems).toEqual([]);
  const browser = (info.project.use && info.project.use.browserName) || 'chromium';
  if (browser !== 'webkit') {
    const shot = info.project.name === 'phone' ? '/opt/cursor/artifacts/free_light_map_390.png' : '/opt/cursor/artifacts/free_light_map_desktop.png';
    await page.screenshot({ path: shot });
  }
  const menu = page.locator('#menu-button');
  if (await menu.isVisible()) await menu.click();
  const darkTiles = page.waitForRequest((req) => req.url().includes('/api/mapbox/styles/v1/mapbox/dark-v11/'), { timeout: 20_000 });
  await page.evaluate(() => document.getElementById('map-theme-dark').click());
  await darkTiles;
  expect(seen.urls.some((url) => url.includes(LIGHT_STYLE))).toBe(false);
  await expect(page.locator('#map-theme-dark')).toBeChecked();
  const back = page.waitForFunction(() => document.querySelector('#map .maplibregl-canvas'));
  await page.evaluate(() => document.getElementById('map-theme-light').click());
  await back;
  await painted(page, '#map');
  expect(seen.urls.filter((url) => url.includes(LIGHT_STYLE))).toEqual([]);
  expect(seen.problems).toEqual([]);
});

test('line page light map uses OpenFreeMap', async ({ page, baseURL }) => {
  const seen = track(page, baseURL);
  await page.goto('/lines/amtrak-acela/');
  await page.waitForRequest((req) => req.url().includes('tiles.openfreemap.org'), { timeout: 30_000 });
  await painted(page, '#lp-map');
  await expect(page.locator('#lp-map .leaflet-control-attribution')).toContainText('OpenFreeMap');
  expect(seen.urls.filter((url) => url.includes('/api/mapbox/'))).toEqual([]);
  expect(seen.problems).toEqual([]);
});

test('public profile card map uses the free light layer', async ({ page, baseURL }) => {
  const seen = track(page, baseURL);
  await page.goto('/user/');
  await page.waitForFunction(() => window.L && window.RRFreeLightLayer);
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = 'rr-card-map';
    el.className = 'trip-log-row-map';
    el.style.cssText = 'width:320px;height:180px;position:relative';
    document.body.appendChild(el);
    const map = window.L.map(el, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false });
    window.RRFreeLightLayer({ maxZoom: 16 }).addTo(map);
    map.setView([42.36, -71.06], 12);
  });
  await page.waitForRequest((req) => req.url().includes('tiles.openfreemap.org'), { timeout: 30_000 });
  await painted(page, '#rr-card-map');
  expect(seen.urls.filter((url) => url.includes('/api/mapbox/'))).toEqual([]);
  expect(seen.problems).toEqual([]);
});

test('blocked OpenFreeMap falls back without the Mapbox light style', async ({ page, context, baseURL }) => {
  const seen = track(page, baseURL);
  const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await context.route(/https:\/\/tiles\.openfreemap\.org\//, (route) => route.abort('failed'));
  await context.route(/https:\/\/[a-z]\.basemaps\.cartocdn\.com\//, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: tile }));
  await page.goto('/map/');
  await page.waitForRequest((req) => req.url().includes('basemaps.cartocdn.com/light_all/'), { timeout: 20_000 });
  expect(seen.urls.filter((url) => url.includes(LIGHT_STYLE) || url.includes('/api/mapbox/'))).toEqual([]);
});
