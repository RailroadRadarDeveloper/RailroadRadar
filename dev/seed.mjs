// Wipes the local emulators and loads the test users from users.json plus a few train reports on trains running now.
// Usage: node dev/seed.mjs [site folder]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(DEV, '..'));
const PROJECT = 'railroadradar-accounts';
const FS = `http://localhost:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://localhost:9099';
const WORKER = 'https://railroadradar-proxy.railroadradar.workers.dev';
// "Bearer owner" is the emulators' admin token: it skips security rules.
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const DAY = 24 * 60 * 60 * 1000;

const users = JSON.parse(fs.readFileSync(path.join(DEV, 'users.json'), 'utf8'));

async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try { await fetch(url); return; } catch (_) { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error('Emulator not answering at ' + url);
}

async function call(method, url, body) {
  const res = await fetch(url, { method, headers: OWNER, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(method + ' ' + url + ': ' + res.status + ' ' + (await res.text()));
  return res;
}

function value(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } };
}

const setDoc = (docPath, data) => call('PATCH', `${FS}/${docPath}`, { fields: value(data).mapValue.fields });

// Matches the site's versions, so set-up users don't get the Terms prompt.
function legalVersions() {
  try {
    const js = fs.readFileSync(path.join(ROOT, 'assets/js/app-main.js'), 'utf8');
    return { terms: js.match(/RR_TERMS_VERSION = '([^']+)'/)[1], privacy: js.match(/RR_PRIVACY_VERSION = '([^']+)'/)[1] };
  } catch (_) {
    return { terms: null, privacy: null };
  }
}

const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

function report(uid, at, fields) {
  const u = users[uid];
  const label = u.name.split(' ')[0] + ' ' + u.name.split(' ')[1][0] + '.';
  const by = { uid, label, displayMode: 'first_initial', at: at.getTime(), verified: !!u.verified };
  return Object.assign({
    reportedByUid: uid, reportedByDisplayMode: 'first_initial', reportedByLabel: label, reportedByPhotoURL: null,
    reportedByVerified: !!u.verified, contributors: [by], comment: '',
    firstReportedByUid: uid, firstReportedByDisplayMode: 'first_initial', firstReportedByLabel: label,
    createdAt: at, updatedAt: at, locomotives: null, locomotiveId2: '', unitName2: '', locoType2: '', locoIconUrl2: null,
    specialOverride: false
  }, fields);
}

async function liveJson(route) {
  try {
    const res = await fetch(WORKER + route);
    return res.ok ? await res.json() : null;
  } catch (_) {
    return null;
  }
}

async function seedReports() {
  const made = [];
  const today = nyToday();
  const amtrak = await liveJson('/api/amtrak/trains');
  const running = Object.values(amtrak || {}).flat()
    .filter((t) => t && t.provider === 'Amtrak' && t.trainState === 'Active' && t.trainNum)
    .slice(0, 2);
  const locos = ['620', '651'];
  for (const [i, t] of running.entries()) {
    const num = String(t.trainNum);
    const by = i === 0 ? 'alice' : 'bob';
    await setDoc(`trainReports/amtrak_${today}_${num}`, report(by, new Date(Date.now() - (i + 1) * 20 * 60 * 1000), {
      agency: 'amtrak', trainNumber: num, vehicleId: '', serviceDate: today,
      unitName: locos[i], locomotiveId: locos[i], locoType: 'ACS-64', locoIconUrl: '/assets/amtrak-acs64.png'
    }));
    made.push(`Amtrak ${num} (${t.routeName}) reported by ${by} today`);
  }
  // An MBTA pairing older than a week, so its popup asks "Still this unit?".
  const mbta = await liveJson('/api/mbta/vehicles?filter[route_type]=2');
  const v = mbta && mbta.data && mbta.data[0];
  if (v) {
    const at = new Date(Date.now() - 8 * DAY);
    await setDoc(`trainReports/mbta_${v.id}`, report('alice', at, {
      agency: 'mbta', trainNumber: '', vehicleId: v.id, serviceDate: null,
      unitName: '1100', locomotiveId: '1100', locoType: '', locoIconUrl: '/assets/hsp46.png'
    }));
    made.push(`MBTA vehicle ${v.id} reported by alice 8 days ago`);
  } else {
    made.push('No MBTA trains running, so no week-old MBTA report');
  }
  return made;
}

async function main() {
  await waitFor('http://localhost:8080/');
  await waitFor(AUTH + '/');
  await call('DELETE', `http://localhost:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
  await call('DELETE', `${AUTH}/emulator/v1/projects/${PROJECT}/accounts`);

  // The Google provider id matches the sub that rrDev.signIn sends, so sign-in lands on this uid.
  await call('POST', `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchCreate`, {
    users: Object.entries(users).map(([uid, u]) => ({
      localId: uid, email: u.email, emailVerified: true, displayName: u.name,
      providerUserInfo: [{ providerId: 'google.com', rawId: uid, email: u.email, displayName: u.name }]
    }))
  });

  const legal = legalVersions();
  const now = new Date();
  for (const [uid, u] of Object.entries(users)) {
    await setDoc(`accounts/${uid}`, { uid, email: u.email, displayName: u.name, photoURL: null, createdAt: now, lastLoginAt: now });
    if (u.setup) {
      await setDoc(`userSettings/${uid}`, {
        legalAccepted: true, legalAcceptedAt: now.toISOString(), termsVersion: legal.terms, privacyVersion: legal.privacy,
        email: u.email, displayName: u.name, interestedRailroads: ['mbta', 'amtrak', 'mnr'], interestedRailroadsSet: true,
        reportDisplayMode: 'first_initial', reportCustomLabel: '', publicProfile: !!u.username, username: u.username || ''
      });
    }
    if (u.username) {
      await setDoc(`usernames/${u.username}`, { uid, username: u.username });
      await setDoc(`publicProfiles/${uid}`, { uid, username: u.username, displayName: u.name, photoURL: null });
    }
    if (u.admin) await setDoc(`admins/${u.email}`, { email: u.email, perms: u.admin });
    if (u.verified) await setDoc(`verifiedReporters/${uid}`, { uid, label: u.name, verifiedAt: now });
    if (u.held) await setDoc(`reportHold/${uid}`, { uid, required: true, at: now });
    if (u.banned) await setDoc(`bannedUsers/${uid}`, { uid, email: u.email, reason: 'Test ban', bannedAt: now });
  }

  const reports = await seedReports();
  console.log('Test users: ' + Object.keys(users).join(', '));
  reports.forEach((r) => console.log(r));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
