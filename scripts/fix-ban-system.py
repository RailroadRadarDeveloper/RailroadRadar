from pathlib import Path

AUTH_OLD = '''          if (user) {
            if (typeof hideMyTripsGuestHome === 'function') hideMyTripsGuestHome();'''

AUTH_NEW = '''          if (user) {
            try {
              if (typeof checkUserBanned === 'function') {
                const ban = await checkUserBanned(user);
                if (ban) {
                  const why = ban.reason ? (' Reason: ' + ban.reason) : '';
                  try { await auth.signOut(); } catch (_) {}
                  currentUser = null;
                  if (typeof showNotification === 'function') showNotification('This account is banned.' + why);
                  else alert('This account is banned.' + why);
                  return;
                }
              }
            } catch (banErr) { console.warn('[bannedUsers] auth check', banErr); }
            if (typeof hideMyTripsGuestHome === 'function') hideMyTripsGuestHome();'''

SAVE_OLD = '''async function saveTripLog() {
      setTripLogError('');
      if (!auth || !db) {
        setTripLogError('Firebase is not available.');
        return;
      }
      const saveUser = (typeof rrAuthUser === 'function') ? rrAuthUser() : currentUser;'''

SAVE_NEW = '''async function saveTripLog() {
      setTripLogError('');
      if (!auth || !db) {
        setTripLogError('Firebase is not available.');
        return;
      }
      const saveUser = (typeof rrAuthUser === 'function') ? rrAuthUser() : currentUser;
      if (saveUser && typeof checkUserBanned === 'function') {
        try {
          const ban = await checkUserBanned(saveUser);
          if (ban) {
            setTripLogError('This account is banned' + (ban.reason ? (': ' + ban.reason) : '.'));
            return;
          }
        } catch (_) {}
      }'''

BAN_SET_OLD = '''        await db.collection('bannedUsers').doc(docId).set({
          uid: uid,
          email: email || null,
          reason: reason || null,
          bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
          bannedByEmail: normalizeEmail(user.email) || user.email || null,
          bannedByUid: user.uid
        }, { merge: true });
        showNotification('User banned');'''

BAN_SET_NEW = '''        try {
          await db.collection('bannedUsers').doc(docId).set({
            uid: uid,
            email: email || null,
            reason: reason || null,
            bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
            bannedByEmail: normalizeEmail(user.email) || user.email || null,
            bannedByUid: user.uid
          }, { merge: true });
        } catch (banWriteErr) {
          const msg = (banWriteErr && banWriteErr.message) ? banWriteErr.message : String(banWriteErr);
          setAdminError('Ban failed: ' + msg + '. Publish rules that let admins write bannedUsers.');
          return;
        }
        showNotification('User banned');'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    n = 0
    if AUTH_OLD in t:
        t = t.replace(AUTH_OLD, AUTH_NEW, 1); n += 1; print('auth', path)
    if SAVE_OLD in t:
        t = t.replace(SAVE_OLD, SAVE_NEW, 1); n += 1; print('save', path)
    if BAN_SET_OLD in t:
        t = t.replace(BAN_SET_OLD, BAN_SET_NEW, 1); n += 1; print('write', path)
    print('replacements', n, path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
