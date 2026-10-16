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
  owner: { email: 'turokerr@gmail.com' },
  fakeOwner: { email: 'turokerr@gmail.com', email_verified: false }
};

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
const comment = (uid, extra) => ({ uid, text: 'Nice', displayName: 'Alice', ...extra });

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
    set('specialMoveShares/alice', share('alice'));
    set('specialMoveShares/bob', share('bob', { expireAt: hoursFromNow(-1) }));
    set('accounts/alice', { uid: 'alice' });
    set('pressReleases/pr1', { title: 'News' });
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
  it('an admin doc does not count for an unverified email', async () => {
    await no(as('fakeViewer').collection('admins').get());
    await no(as('fakeViewer').doc('specialUnits/x').set({ a: 1 }));
  });
});

describe('pairings', () => {
  it('anyone can read', () => ok(anon().doc('pairings/1700').get()));
  it('verified user writes own pairing', () => ok(as('bob').doc('pairings/1701').set(pairing('bob', { leadCar: '1701' }))));
  it('denies a pairing filed under someone else', () => no(as('bob').doc('pairings/1701').set(pairing('alice', { leadCar: '1701' }))));
  it('denies a leadCar that does not match the doc id', () => no(as('bob').doc('pairings/1701').set(pairing('bob'))));
  it('denies an engine over 64 characters', () => no(as('bob').doc('pairings/1701').set(pairing('bob', { leadCar: '1701', engine: 'x'.repeat(65) }))));
  it('denies unverified and banned users', async () => {
    await no(as('unverified').doc('pairings/1701').set(pairing('unverified', { leadCar: '1701' })));
    await no(as('banned').doc('pairings/1701').set(pairing('banned', { leadCar: '1701' })));
  });
  it('only the reporter deletes', async () => {
    await no(as('bob').doc('pairings/1700').delete());
    await ok(as('alice').doc('pairings/1700').delete());
  });
});

describe('trainReports', () => {
  it('anyone can read', () => ok(anon().doc('trainReports/r1').get()));
  it('verified user writes own report', () => ok(as('bob').doc('trainReports/r2').set({ reportedByUid: 'bob' })));
  it('denies a report filed under someone else', () => no(as('bob').doc('trainReports/r2').set({ reportedByUid: 'alice' })));
  it('admin may file for someone else', () => ok(as('viewer').doc('trainReports/r2').set({ reportedByUid: 'alice' })));
  it('denies anonymous, unverified, banned uid and banned email', async () => {
    await no(anon().doc('trainReports/r2').set({ reportedByUid: null }));
    await no(as('unverified').doc('trainReports/r2').set({ reportedByUid: 'unverified' }));
    await no(as('banned').doc('trainReports/r2').set({ reportedByUid: 'banned' }));
    await no(as('bannedMail').doc('trainReports/r2').set({ reportedByUid: 'bannedMail' }));
  });
  it('delete: reporter or deleteReports admin only', async () => {
    await no(as('bob').doc('trainReports/r1').delete());
    await no(as('viewer').doc('trainReports/r1').delete());
    await ok(as('admin').doc('trainReports/r1').delete());
  });
  it('reporter deletes own report', () => ok(as('alice').doc('trainReports/r1').delete()));
  // Main lets any verified user take over someone else's report. The fix/firestore-rules branch closes this
  // and must drop the todo marker so the case fails the suite if the fix is ever undone.
  it('denies taking over someone else\'s report or audit row', { todo: 'allowed by the current rules' }, async () => {
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
  it('user creates own pending report', async () => {
    await ok(as('bob').doc('pendingReports/p2').set({ reportedByUid: 'bob' }));
    await no(as('bob').doc('pendingReports/p3').set({ reportedByUid: 'alice' }));
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
  it('user writes own audit row', async () => {
    await ok(as('bob').doc('reportAudit/a2').set({ reportedByUid: 'bob' }));
    await no(as('bob').doc('reportAudit/a3').set({ reportedByUid: 'alice' }));
  });
});

describe('actionLog', () => {
  it('user creates own entry with action, uid and at', async () => {
    await ok(as('bob').doc('actionLog/l2').set({ action: 'x', uid: 'bob', at: 1 }));
    await no(as('bob').doc('actionLog/l3').set({ action: 'x', uid: 'alice', at: 1 }));
    await no(as('bob').doc('actionLog/l4').set({ action: 'x', uid: 'bob' }));
    await no(as('banned').doc('actionLog/l5').set({ action: 'x', uid: 'banned', at: 1 }));
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
  for (const c of ['specialUnits', 'verifiedReporters', 'tracksideFavorites', 'pressReleases']) {
    it(`${c}: anyone reads, only admins write`, async () => {
      await ok(anon().doc(`${c}/x`).get());
      await no(as('alice').doc(`${c}/x`).set({ a: 1 }));
      await ok(as('viewer').doc(`${c}/x`).set({ a: 1 }));
    });
  }
});

describe('usernames', () => {
  it('claim must match the lowercased name and own uid', async () => {
    await ok(as('bob').doc('usernames/bob').set({ uid: 'bob', username: 'Bob' }));
    await no(as('bob').doc('usernames/bobby').set({ uid: 'bob', username: 'Bob' }));
    await no(as('bob').doc('usernames/carol').set({ uid: 'alice', username: 'carol' }));
  });
  it('only the owner updates or releases a name', async () => {
    await no(as('bob').doc('usernames/alice').set({ uid: 'bob', username: 'alice' }));
    await no(as('bob').doc('usernames/alice').delete());
    await ok(as('alice').doc('usernames/alice').delete());
  });
});

describe('publicProfiles', () => {
  it('anyone reads', () => ok(anon().doc('publicProfiles/alice').get()));
  it('owner writes a card with the required fields', async () => {
    await ok(as('bob').doc('publicProfiles/bob').set(profile('bob', { username: 'bob' })));
    await no(as('bob').doc('publicProfiles/bob').set({ uid: 'bob', username: 'bob' }));
    await no(as('bob').doc('publicProfiles/alice').set(profile('alice')));
  });
  it('only the owner deletes a card', () => no(as('bob').doc('publicProfiles/alice').delete()));
});

describe('tripLogs', () => {
  it('create needs own uid, required fields and an /assets/ icon', async () => {
    await ok(as('bob').doc('tripLogs/b1').set(trip('bob')));
    await ok(as('bob').doc('tripLogs/b2').set(trip('bob', { icon: '/assets/hsp46.png' })));
    await no(as('bob').doc('tripLogs/b3').set(trip('alice')));
    await no(as('bob').doc('tripLogs/b4').set(trip('bob', { miles: '12' })));
    await no(as('bob').doc('tripLogs/b5').set(trip('bob', { icon: 'https://example.com/x.png' })));
    const { trainNumber, ...missing } = trip('bob');
    await no(as('bob').doc('tripLogs/b6').set(missing));
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
  it('owner shares for at most 6 hours', async () => {
    await ok(as('bob').doc('specialMoveShares/bob').set(share('bob')));
    await no(as('bob').doc('specialMoveShares/bob').set(share('bob', { expireAt: hoursFromNow(7) })));
    await no(as('bob').doc('specialMoveShares/alice').set(share('alice')));
    await no(as('bob').doc('specialMoveShares/bob').set(share('bob', { icon: '/x/evil.png' })));
  });
  it('anyone gets an unexpired active share, not an expired one', async () => {
    await ok(anon().doc('specialMoveShares/alice').get());
    await no(anon().doc('specialMoveShares/bob').get());
    await ok(as('bob').doc('specialMoveShares/bob').get());
  });
  it('listing requires the active filter', async () => {
    await ok(anon().collection('specialMoveShares').where('active', '==', true).get());
    await no(anon().collection('specialMoveShares').get());
  });
  it('owner or admin deletes', async () => {
    await no(as('bob').doc('specialMoveShares/alice').delete());
    await ok(as('viewer').doc('specialMoveShares/bob').delete());
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
  it('a banned uid or email files one valid appeal while signed out', async () => {
    await ok(anon().doc('banAppeals/banned').set(appeal('banned')));
    await ok(anon().doc('banAppeals/someone').set(appeal('someone', { email: 'bm@example.com' })));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { message: 'again' })));
  });
  it('denies appeals without the ban token, for users who are not banned, or that break the schema', async () => {
    await no(anon().doc('banAppeals/alice').set(appeal('alice')));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { status: 'approved' })));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { extra: 1 })));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { message: 'x'.repeat(2001) })));
    const noToken = appeal('banned');
    delete noToken.token;
    await no(anon().doc('banAppeals/banned').set(noToken));
    await no(anon().doc('banAppeals/banned').set(appeal('banned', { token: 'b'.repeat(32) })));
    await no(anon().doc('banAppeals/other').set(appeal('other', { email: 'bm@example.com' })));
  });
  it('only admins read', async () => {
    await no(anon().doc('banAppeals/banned').get());
    await ok(as('viewer').doc('banAppeals/banned').get());
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
  });
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
