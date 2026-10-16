import { defineConfig } from '@playwright/test';

const port = Number(process.env.SMOKE_PORT || 8203);

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  workers: process.env.RECORD ? 1 : undefined,
  retries: 0,
  reporter: [['list']],
  outputDir: '../test-results',
  use: {
    baseURL: `http://localhost:${port}`,
    timezoneId: 'America/New_York',
    locale: 'en-US',
    // A service worker would answer requests before the fixture routes see them.
    serviceWorkers: 'block',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: {
    command: 'node server.js',
    url: `http://localhost:${port}/`,
    env: { SMOKE_PORT: String(port) },
    // Never test whatever else happens to be listening on the port.
    reuseExistingServer: false
  }
});
