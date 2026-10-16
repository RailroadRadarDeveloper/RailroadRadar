// Re-records the Worker responses the smoke test serves, using plain GETs to the live Worker.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixtures = fileURLToPath(new URL('fixtures/', import.meta.url));
fs.rmSync(fixtures, { recursive: true, force: true });
fs.mkdirSync(fixtures);
const r = spawnSync('npx', ['playwright', 'test', '--config', 'smoke/playwright.config.js', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, RECORD: '1', RECORDED_AT: new Date().toISOString() }
});
process.exit(r.status ?? 1);
