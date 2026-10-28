// Allow/deny cases for each collection in firestore.rules. Run through run.js, which starts the emulator.
import fs from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const { FieldValue, Timestamp } = firebase.firestore;
// Every denied write is otherwise logged as a warning.
firebase.firestore.setLogLevel('silent');
const now = () => FieldValue.serverTimestamp();
const hoursFromNow = (h) => Timestamp.fromMillis(Date.now() + h * 3600e3);
const TOKEN = 'a'.repeat(32);

const USERS = {
  alice: { email: 'alice@example.com' },
  bob: { email: 'bob@example.com' },
  unverified: { email: 'unv@example.com', email_verified: false },
  banned: { email: 'banned@example.com' },
  bannedMail: { email: 'bm@example.com' },
  admin: { email: 'admin@example.com' },
  viewer: { email: 'viewer@example.com' },
  fakeViewer: { email: 'viewer@example.com', email_verified: false },
  noperms: { email: 'noperms@example.com' },
  ver: { email: 'ver@example.com' },
  owner: { email: 'turokerr@gmail.com' },
  fakeOwner: { email: 'turokerr@gmail.com', email_verified: false },
  // Looks like a real Firebase uid (28 mixed-case chars), for legacy uid-keyed shares.
  LegacyUid0123456789abcdefXYZ: { email: 'legacy@example.com' }
};
const LEGACY = 'LegacyUid0123456789abcdefXYZ';

let env;
const as = (uid) => env.authenticatedContext(uid, { email_verified: true, ...USERS[uid] }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ok = (p) => assertSucceeds(p);
const no = (p) => assertFails(p);

const pairing = (uid, extra) => ({ leadCar: '1700', engine: '1036', reportedByUid: uid, updatedAt: now(), ...extra });
const trip = (uid, extra) => ({
  userId: uid, railroad: 'mbta', originStationId: 'a', originName: 'A', destStationId: 'b', destName: 'B',
  trainNumber: '371', startTime: '2026-10-15T18:00', miles: 12.5, ...extra
});
const stopActuals = (uid, extra) => ({
  agency: 'mbta', trainNumber: '371', serviceDate: '2026-10-15', stops: [{ id: 'a', t: 1 }], updatedAt: now(), updatedByUid: uid, ...extra
});
const share = (uid, extra) => ({ uid, lat: 42.3, lon: -71.1, expireAt: hoursFromNow(1), active: true, ...extra });
const profile = (uid, extra) => ({ uid, username: 'Alice', displayName: 'Alice', photoURL: null, ...extra });
const appeal = (uid, extra) => ({ uid, message: 'please', createdAt: now(), status: 'open', token: TOKEN, ...extra });
const survey = (extra) => ({ v: 1, rating: 4, source: 'page', createdAt: now(), ...extra });
const comment = (uid, extra) => ({ uid, text: 'Nice', displayName: 'Alice', createdAt: now(), ...extra });
// A report as the site writes it on first submission.
const entry = (uid, extra) => ({ uid, label: 'A.', displayMode: 'first_initial', at: Date.now(), verified: false, ...extra });
const report = (uid, extra) => ({
  agency: 'mbta', trainNumber: null, vehicleId: '1700', unitName: '1036', serviceDate: null,
  reportedByUid: uid, reportedByDisplayMode: 'first_initial', reportedByLabel: 'A.', reportedByPhotoURL: null,
  reportedByVerified: false, contributors: [entry(uid)], updatedAt: now(), comment: '',
  firstReportedByUid: uid, firstReportedByDisplayMode: 'first_initial', firstReportedByLabel: 'A.',
  locomotives: null, locomotiveId2: '', unitName2: '', locoType2: '', locoIconUrl2: null,
  locomotiveId: '1036', specialOverride: false, locoType: '', locoIconUrl: '/assets/hsp46.png', createdAt: now(), ...extra
});
const pending = (uid, extra) => {
  const { createdAt, ...r } = report(uid);
  return { ...r, status: 'pending', submittedAt: now(), ...extra };
};
const auditEntry = (uid, extra) => ({ uid, email: USERS[uid].email, name: 'N', label: 'A.', displayMode: 'first_initial', at: Date.now(), verified: false, ...extra });

before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-railroadradar',
    firestore: { host, port: Number(port), rules: fs.readFileSync(process.env.RULES_FILE, 'utf8') }
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const b = ctx.firestore().batch();
    const set = (p, d) => b.set(ctx.firestore().doc(p), d);
    set('bannedUsers/banned', { uid: 'banned', statusToken: TOKEN });
    set('bannedEmails/bm@example.com', { email: 'bm@example.com', uid: 'someone', statusToken: TOKEN });
    set('admins/admin@example.com', { perms: { viewReports: true, banUsers: true, manageAdmins: true, deleteReports: true } });
    set('admins/viewer@example.com', { perms: { viewReports: true, banUsers: false, manageAdmins: false, deleteReports: false } });
    set('admins/noperms@example.com', { perms: { viewReports: false, banUsers: false, manageAdmins: false, deleteReports: false } });
    set('verifiedReporters/ver', { uid: 'ver' });
    set('reportHold/alice', { required: true });
    set('pairings/1700', pairing('alice'));
    set('trainReports/r1', { reportedByUid: 'alice', trainNumber: '371' });
    set('pendingReports/p1', { reportedByUid: 'alice' });
    set('reportAudit/a1', { reportedByUid: 'alice' });
    set('actionLog/l1', { action: 'x', uid: 'alice', at: 1 });
    set('userSettings/alice', { theme: 'dark' });
    set('usernames/alice', { uid: 'alice', username: 'Alice' });
    set('publicProfiles/alice', profile('alice'));
    set('tripLogs/alicePublic', trip('alice', { hiddenPublic: false }));
    set('tripLogs/alicePrivate', trip('alice', { hiddenPublic: true }));
    set('tripLogs/bobPublic', trip('bob', { hiddenPublic: false }));
    set('trainStopActuals/s1', stopActuals('alice'));
    set('specialMoveShares/aliceshr01', share('alice'));
    set('specialMoveShares/bobshare01', share('bob', { expireAt: hoursFromNow(-1) }));
    set('specialMoveShares/' + LEGACY, share(LEGACY));
    set('accounts/alice', { uid: 'alice' });
    set('pressReleases/pr1', { title: 'News', commentsEnabled: true });
    set('pressReleases/pr2', { title: 'Closed', commentsEnabled: false });
    set('surveyResponses/s1', { v: 1, rating: 5, source: 'popup', email: 'x@example.com' });
    set('pressReleases/pr1/comments/c1', comment('alice', { email: 'alice@example.com', displayName: 'alice@example.com' }));
    await b.commit();
  });
});

describe('admin checks', () => {
  it('bootstrap email counts only when verified', async () => {
    await ok(as('owner').collection('admins').get());
    await no(as('fakeOwner').collection('admins').get());
  });
  it('an admin doc grants admin', () => ok(as('viewer').collection('admins').get()));
  it('an admin doc with every perm off grants nothing', async () => {
    await no(as('noperms').collection('admins').get());
    await no(as('noperms').collection('accounts').get());
    await no(as('noperms').doc('specialUnits/x').set({ a: 1 }));
  });
  it('an admin doc does not count for an unverified email', async () => {
    await no(as('fakeViewer').collection('admins').get());
    await no(as('fakeViewer').doc('specialUnits/x').set({ a: 1 }));
  });
});

describe('pairings', () => {
  // No page or Worker uses pairings, so the rules no longer have a match for it.
  it('nobody reads or writes', async () => {
    await no(anon().doc('pairings/1700').get());
    await no(as('bob').doc('pairings/1701').set(pairing('bob', { leadCar: '1701' })));
    await no(as('alice').doc('pairings/1700').delete());
  });
});

describe('trainReports', () => {
  it('anyone can read', () => ok(anon().doc('trainReports/r1').get()));
  it('verified user writes own report in the site\'s shape', async () => {
    await ok(as('bob').doc('trainReports/mbta_1700').set(report('bob')));
    await no(as('bob').doc('trainReports/r2').set({ reportedByUid: 'bob' }));
  });
  it('denies a doc id for another agency, extra fields, emails and outside icons', async () => {
    await no(as('bob').doc('trainReports/amtrak_1700').set(report('bob')));
    await no(as('bob').doc('trainReports/mbta_1700').set(report('bob', { extra: 1 })));
    await no(as('bob').doc('trainReports/mbta_1700').set(report('bob', { reportedByEmail: 'bob@example.com' })));
    await no(as('bob').doc('trainReports/mbta_1700').set(report('bob', { locoIconUrl: 'https://example.com/x.png' })));
    await no(as('bob').doc('trainReports/mbta_1700').set(report('bob', { unitName: ['x'.repeat(200)] })));
  });
  it('the verified badge needs a verifiedReporters doc', async () => {
    await no(as('bob').doc('trainReports/mbta_1700').set(report('bob', { reportedByVerified: true, contributors: [entry('bob', { verified: true })] })));
    await ok(as('ver').doc('trainReports/mbta_1700').set(report('ver', { reportedByVerified: true, contributors: [entry('ver', { verified: true })] })));
  });
  it('a held user cannot write reports directly', () => no(as('alice').doc('trainReports/mbta_1700').set(report('alice'))));
  it('a second reporter appends to contributors and cannot rewrite them', async () => {
    await ok(as('bob').doc('trainReports/mbta_1700').set(report('bob')));
    const { createdAt, firstReportedByUid, firstReportedByLabel, firstReportedByDisplayMode, ...base } = report('ver');
    let first;
    await env.withSecurityRulesDisabled(async (c) => { first = (await c.firestore().doc('trainReports/mbta_1700').get()).data().contributors; });
    await no(as('ver').doc('trainReports/mbta_1700').set({ ...base, contributors: [entry('ver')] }, { merge: true }));
    await ok(as('ver').doc('trainReports/mbta_1700').set({ ...base, contributors: [...first, entry('ver')] }, { merge: true }));
  });
  it('denies a report filed under someone else', () => no(as('bob').doc('trainReports/r2').set({ reportedByUid: 'alice' })));
  it('admin may file for someone else', () => ok(as('viewer').doc('trainReports/r2').set({ reportedByUid: 'alice' })));
  it('denies anonymous, unverified, banned uid and banned email', async () => {
    await no(anon().doc('trainReports/r2').set({ reportedByUid: null }));
    await no(as('unverified').doc('trainReports/r2').set({ reportedByUid: 'unverified' }));
    await no(as('banned').doc('trainReports/r2').set({ reportedByUid: 'banned' }));
    await no(as('bannedMail').doc('trainReports/r2').set({ reportedByUid: 'bannedMail' }));
  });
  it('delete: deleteReports admin only', async () => {
    await no(as('bob').doc('trainReports/r1').delete());
    await no(as('viewer').doc('trainReports/r1').delete());
    await ok(as('admin').doc('trainReports/r1').delete());
  });
  // reportedByUid is whoever confirmed the report last, so it does not make the report theirs to delete.
  it('the last reporter cannot delete', () => no(as('alice').doc('trainReports/r1').delete()));
  it('denies taking over someone else\'s report or audit row', async () => {
    await no(as('bob').doc('trainReports/r1').update({ reportedByUid: 'bob' }));
    await no(as('bob').doc('reportAudit/a1').update({ reportedByUid: 'bob' }));
  });
});

describe('pendingReports', () => {
  it('reporter and admins read, others do not', async () => {
    await ok(as('alice').doc('pendingReports/p1').get());
    await ok(as('viewer').doc('pendingReports/p1').get());
    await no(as('bob').doc('pendingReports/p1').get());
    await no(anon().doc('pendingReports/p1').get());
  });
  it('only a held user creates a pending report, in the site\'s shape', async () => {
    await ok(as('alice').doc('pendingReports/mbta_1700').set(pending('alice')));
    await no(as('alice').doc('pendingReports/mbta_1701').set({ reportedByUid: 'alice' }));
    await no(as('bob').doc('pendingReports/mbta_1702').set(pending('bob')));
    await no(as('alice').doc('pendingReports/mbta_1703').set(pending('bob')));
  });
  it('a held user replaces their own pending report, nobody else\'s', async () => {
    await ok(as('alice').doc('pendingReports/mbta_1700').set(pending('alice')));
    await ok(as('alice').doc('pendingReports/mbta_1700').set(pending('alice', { comment: 'second try' })));
    await env.withSecurityRulesDisabled((c) => c.firestore().doc('reportHold/bob').set({ required: true }));
    await no(as('bob').doc('pendingReports/mbta_1700').set(pending('bob')));
  });
  it('only admins update', async () => {
    await no(as('alice').doc('pendingReports/p1').update({ x: 1 }));
    await ok(as('viewer').doc('pendingReports/p1').update({ x: 1 }));
  });
  it('reporter deletes own', () => ok(as('alice').doc('pendingReports/p1').delete()));
});

describe('reportHold', () => {
  it('user reads own hold only', async () => {
    await ok(as('alice').doc('reportHold/alice').get());
    await no(as('bob').doc('reportHold/alice').get());
  });
  it('only admins write', async () => {
    await no(as('alice').doc('reportHold/alice').delete());
    await ok(as('viewer').doc('reportHold/bob').set({ required: true }));
  });
});

describe('reportAudit', () => {
  it('only admins read', async () => {
    await no(as('alice').doc('reportAudit/a1').get());
    await ok(as('viewer').doc('reportAudit/a1').get());
  });
  it('user appends own audit entry for an existing report', async () => {
    const row = (uid, extra) => ({ reportedByUid: uid, reportedByEmail: USERS[uid].email, updatedAt: now(), contributors: FieldValue.arrayUnion(auditEntry(uid)), ...extra });
    await ok(as('bob').doc('reportAudit/r1').set(row('bob')));
    await no(as('bob').doc('reportAudit/r1').set(row('alice')));
    await no(as('bob').doc('reportAudit/missing').set(row('bob')));
    await no(as('bob').doc('reportAudit/r1').set(row('bob', { reportedByEmail: 'alice@example.com' })));
    await no(as('bob').doc('reportAudit/r1').set(row('bob', { contributors: [auditEntry('bob')] })));
  });
});

describe('actionLog', () => {
  it('user creates own entry with action, uid and at', async () => {
    await ok(as('bob').doc('actionLog/l2').set({ action: 'x', uid: 'bob', at: now() }));
    await no(as('bob').doc('actionLog/l3').set({ action: 'x', uid: 'alice', at: now() }));
    await no(as('bob').doc('actionLog/l4').set({ action: 'x', uid: 'bob' }));
    await no(as('banned').doc('actionLog/l5').set({ action: 'x', uid: 'banned', at: now() }));
  });
  it('at must be the server time, and no other fields or emails', async () => {
    await no(as('bob').doc('actionLog/l6').set({ action: 'x', uid: 'bob', at: 1 }));
    await no(as('bob').doc('actionLog/l7').set({ action: 'x', uid: 'bob', at: now(), extra: 1 }));
    await no(as('bob').doc('actionLog/l8').set({ action: 'x', uid: 'bob', at: now(), email: 'alice@example.com' }));
  });
  it('nobody updates, only the bootstrap admin deletes', async () => {
    await no(as('admin').doc('actionLog/l1').update({ at: 2 }));
    await no(as('admin').doc('actionLog/l1').delete());
    await ok(as('owner').doc('actionLog/l1').delete());
  });
  it('only admins read', async () => {
    await no(as('alice').doc('actionLog/l1').get());
    await ok(as('viewer').doc('actionLog/l1').get());
  });
});

describe('userSettings', () => {
  it('own doc only', async () => {
    await ok(as('alice').doc('userSettings/alice').get());
    await ok(as('alice').doc('userSettings/alice').set({ theme: 'light' }));
    await no(as('bob').doc('userSettings/alice').get());
    await no(anon().doc('userSettings/alice').get());
  });
  it('banned user loses access', () => no(as('banned').doc('userSettings/banned').get()));
  it('denies writing someone else\'s settings', () => no(as('bob').doc('userSettings/alice').set({ theme: 'light' })));
});

describe('bannedUsers and bannedEmails', () => {
  it('banned user reads own ban, others do not', async () => {
    await ok(as('banned').doc('bannedUsers/banned').get());
    await no(as('alice').doc('bannedUsers/banned').get());
    await ok(as('bannedMail').doc('bannedEmails/bm@example.com').get());
    await no(as('alice').doc('bannedEmails/bm@example.com').get());
  });
  it('only banUsers admins ban', async () => {
    await no(as('alice').doc('bannedUsers/bob').set({ uid: 'bob' }));
    await no(as('viewer').doc('bannedUsers/bob').set({ uid: 'bob' }));
    await ok(as('admin').doc('bannedUsers/bob').set({ uid: 'bob' }));
    await no(as('viewer').doc('bannedEmails/bob@example.com').set({}));
    await ok(as('admin').doc('bannedEmails/bob@example.com').set({}));
  });
  it('banned user cannot lift their own ban', async () => {
    await no(as('banned').doc('bannedUsers/banned').delete());
    await no(as('bannedMail').doc('bannedEmails/bm@example.com').delete());
  });
});

describe('admins', () => {
  it('user reads own admin doc only', async () => {
    await ok(as('viewer').doc('admins/viewer@example.com').get());
    await ok(as('alice').doc('admins/alice@example.com').get());
    await no(as('alice').doc('admins/admin@example.com').get());
    await no(as('alice').collection('admins').get());
  });
  it('only manageAdmins admins change the list', async () => {
    await no(as('viewer').doc('admins/bob@example.com').set({ perms: {} }));
    await ok(as('admin').doc('admins/bob@example.com').set({ perms: {} }));
    await no(as('alice').doc('admins/alice@example.com').set({ perms: { manageAdmins: true } }));
  });
  it('an admin cannot grant itself manageAdmins', () => no(as('viewer').doc('admins/viewer@example.com').update({ 'perms.manageAdmins': true })));
});

describe('public admin-managed collections', () => {
  for (const c of ['specialUnits', 'tracksideFavorites', 'pressReleases']) {
    it(`${c}: anyone reads, only admins write`, async () => {
      await ok(anon().doc(`${c}/x`).get());
      await no(as('alice').doc(`${c}/x`).set({ a: 1 }));
      await ok(as('viewer').doc(`${c}/x`).set({ a: 1 }));
    });
  }
});

describe('verifiedReporters', () => {
  // Public for the checkmarks, so it may not hold an email or name.
  const v = (extra) => ({ uid: 'x', verifiedAt: now(), verifiedByUid: 'viewer', ...extra });
  it('anyone reads, only admins write a uid-only doc', async () => {
    await ok(anon().doc('verifiedReporters/x').get());
    await no(as('alice').doc('verifiedReporters/x').set(v()));
    await ok(as('viewer').doc('verifiedReporters/x').set(v()));
    await no(as('viewer').doc('verifiedReporters/x').set(v({ email: 'x@example.com' })));
    await no(as('viewer').doc('verifiedReporters/y').set(v()));
  });
});

describe('usernames', () => {
  it('claim must match the lowercased name and own uid', async () => {
    await ok(as('bob').doc('usernames/bob').set({ uid: 'bob', username: 'Bob' }));
    await no(as('bob').doc('usernames/bobby').set({ uid: 'bob', username: 'Bob' }));
    await no(as('bob').doc('usernames/carol').set({ uid: 'alice', username: 'carol' }));
  });
  it('same format and reserved names as the settings form', async () => {
    await no(as('bob').doc('usernames/admin').set({ uid: 'bob', username: 'admin' }));
    await no(as('bob').doc('usernames/ab').set({ uid: 'bob', username: 'ab' }));
    await no(as('bob').doc('usernames/bob-x').set({ uid: 'bob', username: 'bob-x' }));
    await no(as('bob').doc('usernames/bobx').set({ uid: 'bob', username: 'bobx', extra: 1 }));
  });
  it('only the owner updates or releases a name', async () => {
    await no(as('bob').doc('usernames/alice').set({ uid: 'bob', username: 'alice' }));
    await no(as('bob').doc('usernames/alice').delete());
    await ok(as('alice').doc('usernames/alice').delete());
  });
});

describe('publicProfiles', () => {
  it('anyone reads', () => ok(anon().doc('publicProfiles/alice').get()));
  it('owner writes a card for a username they claimed in the same batch', async () => {
    const db = as('bob');
    const b = db.batch();
    b.set(db.doc('usernames/bob'), { uid: 'bob', username: 'bob' });
    b.set(db.doc('publicProfiles/bob'), profile('bob', { username: 'bob' }));
    await ok(b.commit());
    await no(as('bob').doc('publicProfiles/bob').set({ uid: 'bob', username: 'bob' }));
    await no(as('bob').doc('publicProfiles/alice').set(profile('alice')));
  });
  it('denies a card showing someone else\'s username or an outside photo', async () => {
    await no(as('bob').doc('publicProfiles/bob').set(profile('bob', { username: 'Alice' })));
    await no(as('alice').doc('publicProfiles/alice').set(profile('alice', { photoURL: 'https://example.com/me.png' })));
  });
  it('only the owner deletes a card', () => no(as('bob').doc('publicProfiles/alice').delete()));
});

describe('tripLogs', () => {
  it('create needs own uid, required fields and an /assets/ icon', async () => {
    await ok(as('bob').doc('tripLogs/b1').set(trip('bob', { hiddenPublic: false })));
    await ok(as('bob').doc('tripLogs/b2').set(trip('bob', { hiddenPublic: true, icon: '/assets/hsp46.png' })));
    await no(as('bob').doc('tripLogs/b7').set(trip('bob')));
    await no(as('bob').doc('tripLogs/b8').set(trip('bob', { hiddenPublic: false, notes: 'x'.repeat(2001) })));
    await no(as('bob').doc('tripLogs/b3').set(trip('alice', { hiddenPublic: false })));
    await no(as('bob').doc('tripLogs/b4').set(trip('bob', { hiddenPublic: false, miles: '12' })));
    await no(as('bob').doc('tripLogs/b5').set(trip('bob', { hiddenPublic: false, icon: 'https://example.com/x.png' })));
    const { trainNumber, ...missing } = trip('bob', { hiddenPublic: false });
    await no(as('bob').doc('tripLogs/b6').set(missing));
  });
  it('a public profile query must filter on hiddenPublic', async () => {
    await ok(anon().collection('tripLogs').where('userId', '==', 'alice').where('hiddenPublic', '==', false).get());
    await no(anon().collection('tripLogs').where('userId', '==', 'alice').get());
  });
  it('public trips are readable only while the profile exists', async () => {
    await ok(anon().doc('tripLogs/alicePublic').get());
    await no(anon().doc('tripLogs/alicePrivate').get());
    await no(anon().doc('tripLogs/bobPublic').get());
    await ok(as('bob').doc('tripLogs/bobPublic').get());
  });
  it('only the owner updates or deletes', async () => {
    await no(as('bob').doc('tripLogs/alicePublic').update({ miles: 1 }));
    await no(as('alice').doc('tripLogs/alicePublic').update({ icon: 'javascript:x' }));
    await ok(as('alice').doc('tripLogs/alicePublic').update({ miles: 1 }));
    await ok(as('alice').doc('tripLogs/alicePrivate').delete());
  });
});

describe('trainStopActuals', () => {
  it('anyone reads', () => ok(anon().doc('trainStopActuals/s1').get()));
  it('verified user writes a valid doc under own uid', async () => {
    await ok(as('bob').doc('trainStopActuals/s2').set(stopActuals('bob')));
    await no(as('bob').doc('trainStopActuals/s3').set(stopActuals('alice')));
    await no(as('bob').doc('trainStopActuals/s4').set(stopActuals('bob', { stops: Array(81).fill(1) })));
    await no(as('unverified').doc('trainStopActuals/s5').set(stopActuals('unverified')));
  });
  it('only admins delete', async () => {
    await no(as('alice').doc('trainStopActuals/s1').delete());
    await ok(as('viewer').doc('trainStopActuals/s1').delete());
  });
});

describe('specialMoveShares', () => {
  it('owner shares for at most 6 hours under a per-share code', async () => {
    await ok(as('bob').doc('specialMoveShares/bobshare99').set(share('bob')));
    await no(as('bob').doc('specialMoveShares/bobshare99').set(share('bob', { expireAt: hoursFromNow(7) })));
    await no(as('bob').doc('specialMoveShares/aliceshr99').set(share('alice')));
    await no(as('bob').doc('specialMoveShares/bobshare99').set(share('bob', { icon: '/x/evil.png' })));
    await no(as('bob').doc('specialMoveShares/short').set(share('bob'))); // share id must be 8–20 chars
  });
  it('anyone gets an unexpired active share, not an expired one', async () => {
    await ok(anon().doc('specialMoveShares/aliceshr01').get());
    await no(anon().doc('specialMoveShares/bobshare01').get());
    await ok(as('bob').doc('specialMoveShares/bobshare01').get());
  });
  it('listing requires the active filter and a recent expireAt bound', async () => {
    const q = (backMin) => anon().collection('specialMoveShares').where('active', '==', true).where('expireAt', '>', Timestamp.fromMillis(Date.now() - backMin * 60e3));
    const snap = await ok(q(5).get());
    const ids = snap.docs.map((d) => d.id).sort().join();
    if (ids !== [LEGACY, 'aliceshr01'].sort().join()) throw new Error('listed ' + ids);
    await no(q(20).get());
    await no(anon().collection('specialMoveShares').where('active', '==', true).get());
    await no(anon().collection('specialMoveShares').get());
  });
  it('denies unknown fields on a share', () => no(as('bob').doc('specialMoveShares/bobshare99').set(share('bob', { photoURL: 'https://example.com/x.png' }))));
  it('owner or admin deletes', async () => {
    await no(as('bob').doc('specialMoveShares/aliceshr01').delete());
    await ok(as('alice').doc('specialMoveShares/aliceshr01').delete());
    await ok(as('viewer').doc('specialMoveShares/bobshare01').delete());
  });
  it('owner updates their own share code doc', () => ok(as('alice').doc('specialMoveShares/aliceshr01').set({ lat: 42.4, updatedAt: Date.now() }, { merge: true })));
  it('denies a foreign-uid update', async () => {
    await no(as('bob').doc('specialMoveShares/aliceshr01').set({ lat: 0 }, { merge: true }));
    await no(as('bob').doc('specialMoveShares/aliceshr01').update({ uid: 'bob' }));
    await no(as('alice').doc('specialMoveShares/aliceshr01').update({ uid: 'bob' }));
  });
  it('denies a foreign create over an existing doc', async () => {
    await no(as('bob').doc('specialMoveShares/aliceshr01').set(share('bob')));
    await no(as('bob').doc('specialMoveShares/aliceshr01').set(share('alice')));
  });
  it('denies creating a doc keyed by a uid', () => no(as(LEGACY).doc('specialMoveShares/' + LEGACY + 'x').set(share(LEGACY))));
  it('legacy owner can end and delete their uid-keyed doc, nobody else can', async () => {
    const legacy = (who) => as(who).doc('specialMoveShares/' + LEGACY);
    await no(legacy('bob').set({ active: false, updatedAt: Date.now(), uid: 'bob' }, { merge: true }));
    await no(legacy('bob').set({ active: false, updatedAt: Date.now(), uid: LEGACY }, { merge: true }));
    await no(legacy('bob').delete());
    // Only ending is allowed on a legacy doc, not keeping it live.
    await no(legacy(LEGACY).set({ lat: 41, updatedAt: Date.now() }, { merge: true }));
    await ok(legacy(LEGACY).get());
    await ok(legacy(LEGACY).set({ active: false, updatedAt: Date.now(), uid: LEGACY }, { merge: true }));
    await no(legacy('bob').delete());
    await ok(legacy(LEGACY).delete());
  });
});

describe('accounts', () => {
  it('own mirror doc only, admins read all', async () => {
    await ok(as('alice').doc('accounts/alice').get());
    await ok(as('bob').doc('accounts/bob').set({ uid: 'bob' }));
    await no(as('bob').doc('accounts/alice').get());
    await no(as('bob').doc('accounts/bob2').set({ uid: 'bob2' }));
    await ok(as('viewer').collection('accounts').get());
  });
});

describe('banAppeals', () => {
  it('an appeal needs the ban\'s status token', async () => {
    const { token, ...noToken } = appeal('banned');
    await no(anon().doc('banAppeals/banned').set(noToken));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { token: 'b'.repeat(32) })));
    await no(anon().doc('banAppeals/other').set(appeal('other', { email: 'bm@example.com' })));
  });
  it('a banned uid or email files one valid appeal while signed out', async () => {
    await ok(anon().doc('banAppeals/banned').set(appeal('banned')));
    await ok(anon().doc('banAppeals/someone').set(appeal('someone', { email: 'bm@example.com' })));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { message: 'again' })));
  });
  it('denies appeals for users who are not banned or that break the schema', async () => {
    await no(anon().doc('banAppeals/alice').set(appeal('alice')));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { status: 'approved' })));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { extra: 1 })));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { message: 'x'.repeat(2001) })));
  });
  it('only banUsers admins read', async () => {
    await env.withSecurityRulesDisabled((c) => c.firestore().doc('banAppeals/banned').set({ uid: 'banned', message: 'm', status: 'open' }));
    await no(anon().doc('banAppeals/banned').get());
    await no(as('viewer').doc('banAppeals/banned').get());
    await ok(as('admin').doc('banAppeals/banned').get());
  });
});

describe('unbanned and appealStatus', () => {
  it('anyone gets a doc by a long token, nobody lists', async () => {
    await ok(anon().doc(`unbanned/${TOKEN}`).get());
    await ok(anon().doc(`appealStatus/${TOKEN}`).get());
    await no(anon().doc('unbanned/short').get());
    await no(anon().collection('unbanned').get());
    await no(anon().collection('appealStatus').get());
  });
  it('only banUsers admins write', async () => {
    await no(as('viewer').doc(`unbanned/${TOKEN}`).set({ at: 1 }));
    await ok(as('admin').doc(`unbanned/${TOKEN}`).set({ at: 1 }));
    await no(as('admin').doc('unbanned/short').set({ at: 1 }));
    await ok(as('admin').doc(`appealStatus/${TOKEN}`).set({ status: 'denied', denyReason: 'no' }));
    await no(as('admin').doc(`appealStatus/${TOKEN}`).set({ status: 'denied', uid: 'banned' }));
    await no(as('admin').doc(`appealStatus/${TOKEN}`).set({ status: 'maybe' }));
  });
});

describe('press release comments', () => {
  const doc = (db, id = 'c2') => db.doc(`pressReleases/pr1/comments/${id}`);
  it('anyone reads', () => ok(doc(anon(), 'c1').get()));
  it('verified user posts a comment without an email', async () => {
    await ok(doc(as('bob')).set(comment('bob')));
    await no(doc(as('bob')).set(comment('alice')));
    await no(doc(as('bob')).set(comment('bob', { email: 'bob@example.com' })));
    await no(doc(as('bob')).set(comment('bob', { displayName: 'bob@example.com' })));
    await no(doc(as('bob')).set(comment('bob', { text: '' })));
    await no(doc(as('unverified')).set(comment('unverified')));
    await no(doc(as('banned')).set(comment('banned')));
    await no(doc(as('bob')).set(comment('bob', { createdAt: Timestamp.fromMillis(1000) })));
    await no(doc(as('bob')).set(comment('bob', { extra: 1 })));
  });
  it('only on a release with comments enabled', () => no(as('bob').doc('pressReleases/pr2/comments/c3').set(comment('bob'))));
  it('admin scrub may only drop the email and fix the name', async () => {
    await ok(doc(as('viewer'), 'c1').update({ email: FieldValue.delete(), displayName: 'A.' }));
    await no(doc(as('viewer'), 'c1').update({ text: 'edited' }));
    await no(doc(as('alice'), 'c1').update({ email: FieldValue.delete() }));
  });
  it('author or admin deletes', async () => {
    await no(doc(as('bob'), 'c1').delete());
    await ok(doc(as('alice'), 'c1').delete());
  });
});

describe('surveyResponses', () => {
  const add = (db, d) => db.collection('surveyResponses').add(d);
  const full = {
    recommend: 9, frequency: 'weekly', uses: ['map', 'mytrips', 'other'], usesOther: 'Railfanning',
    railroads: ['mbta', 'amtrak'], features: ['alerts', 'other'], featuresOther: 'Dark map',
    improve: 'Faster loading', email: 'rider@example.com'
  };
  it('signed-out visitor adds a response without a uid', async () => {
    await ok(add(anon(), survey()));
    await ok(add(anon(), survey(full)));
    await no(add(anon(), survey({ uid: 'alice' })));
  });
  it('signed-in user may add only their own uid', async () => {
    await ok(add(as('alice'), survey({ uid: 'alice' })));
    await ok(add(as('unverified'), survey({ uid: 'unverified' })));
    await no(add(as('alice'), survey({ uid: 'bob' })));
    await no(add(as('alice'), survey()));
  });
  it('rating is required and must be 1 to 5', async () => {
    const { rating, ...noRating } = survey();
    await no(add(anon(), noRating));
    await no(add(anon(), survey({ rating: 0 })));
    await no(add(anon(), survey({ rating: 6 })));
    await no(add(anon(), survey({ rating: 3.5 })));
    await no(add(anon(), survey({ rating: '4' })));
  });
  it('rejects bad choices, extra fields and oversize text', async () => {
    await no(add(anon(), survey({ recommend: 11 })));
    await no(add(anon(), survey({ frequency: 'hourly' })));
    await no(add(anon(), survey({ uses: ['map', 'hack'] })));
    await no(add(anon(), survey({ uses: [] })));
    await no(add(anon(), survey({ railroads: ['septa'] })));
    await no(add(anon(), survey({ features: ['alerts', 'alerts', 'alerts', 'alerts', 'alerts', 'alerts', 'alerts', 'alerts', 'alerts'] })));
    await no(add(anon(), survey({ improve: 'x'.repeat(1001) })));
    await ok(add(anon(), survey({ improve: 'x'.repeat(1000) })));
    await no(add(anon(), survey({ usesOther: 'x'.repeat(121) })));
    await no(add(anon(), survey({ featuresOther: '' })));
    await no(add(anon(), survey({ email: 'not-an-email' })));
    await no(add(anon(), survey({ email: 'a@b.c' + 'x'.repeat(260) })));
    await no(add(anon(), survey({ source: 'bot' })));
    await no(add(anon(), survey({ v: 2 })));
    await no(add(anon(), survey({ ip: '1.2.3.4' })));
    await no(add(anon(), survey({ createdAt: Timestamp.fromMillis(1000) })));
  });
  it('nobody but an admin reads, and nobody edits', async () => {
    await no(anon().doc('surveyResponses/s1').get());
    await no(as('alice').doc('surveyResponses/s1').get());
    await no(as('alice').collection('surveyResponses').get());
    await no(as('fakeViewer').doc('surveyResponses/s1').get());
    await ok(as('viewer').doc('surveyResponses/s1').get());
    await ok(as('admin').collection('surveyResponses').get());
    await no(anon().doc('surveyResponses/s1').update({ rating: 1 }));
    await no(as('admin').doc('surveyResponses/s1').update({ rating: 1 }));
    await no(anon().doc('surveyResponses/s1').set(survey()));
  });
  it('only an admin deletes (retention cleanup)', async () => {
    await no(anon().doc('surveyResponses/s1').delete());
    await no(as('alice').doc('surveyResponses/s1').delete());
    await no(as('noperms').doc('surveyResponses/s1').delete());
    await ok(as('admin').doc('surveyResponses/s1').delete());
  });
});
