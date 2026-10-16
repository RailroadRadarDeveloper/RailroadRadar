// Runs the Firestore rules tests against SITE_DIR's firestore.rules in a local emulator (needs Java).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { siteDir } from '../site-dir.js';

const rules = path.join(siteDir, 'firestore.rules');
const port = Number(process.env.FIRESTORE_EMULATOR_PORT || 8183);
const tests = fileURLToPath(new URL('rules.test.js', import.meta.url));
const firebase = fileURLToPath(new URL('../node_modules/.bin/firebase', import.meta.url));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-rules-'));
const config = path.join(dir, 'firebase.json');
fs.writeFileSync(config, JSON.stringify({
  firestore: { rules },
  emulators: { firestore: { host: '127.0.0.1', port }, ui: { enabled: false }, singleProjectMode: true }
}));

console.log(`Testing ${rules} on emulator port ${port}`);
// A demo- project id keeps the emulator from ever talking to a real Firebase project. Running from the
// temp folder removes the emulator's debug log with it.
const r = spawnSync(firebase, [
  'emulators:exec', '--config', config, '--project', 'demo-railroadradar', '--only', 'firestore',
  `"${process.execPath}" --test --test-reporter=spec "${tests}"`
], { cwd: dir, stdio: 'inherit', env: { ...process.env, RULES_FILE: rules } });
fs.rmSync(dir, { recursive: true, force: true });
process.exit(r.status ?? 1);
