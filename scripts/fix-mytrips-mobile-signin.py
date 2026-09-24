from pathlib import Path

OLD_REQ = '''    function requestGoogleSignIn() {
      if (isSessionLegalAgreed()) {
        markSessionLegalAgreed();
        signInWithGoogle();
        return;
      }
      openSignupPrompt(true);
    }'''

NEW_REQ = '''    function requestGoogleSignIn() {
      if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) {
        signInWithGoogle();
        return;
      }
      if (isSessionLegalAgreed()) {
        markSessionLegalAgreed();
        signInWithGoogle();
        return;
      }
      openSignupPrompt(true);
    }'''

OLD_SIGN = '''    async function signInWithGoogle() {
      if (!auth) {
        showNotification('Firebase is not configured. See SETUP.md.', 'error');
        return;
      }
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const cred = await auth.signInWithPopup(provider);'''

NEW_SIGN = '''    function rrPreferRedirectSignIn() {
      try {
        const ua = navigator.userAgent || '';
        return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(ua);
      } catch (_) { return false; }
    }
    async function signInWithGoogle() {
      if (!auth) {
        showNotification('Firebase is not configured. See SETUP.md.', 'error');
        return;
      }
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        if (rrPreferRedirectSignIn()) {
          await auth.signInWithRedirect(provider);
          return;
        }
        const cred = await auth.signInWithPopup(provider);'''

OLD_AUTH = '''      if (auth) {
        auth.onAuthStateChanged(async function(user) {'''

NEW_AUTH = '''      if (auth) {
        try {
          auth.getRedirectResult().then(function(cred) {
            if (cred && cred.user && typeof upsertAccountMirror === 'function') {
              upsertAccountMirror(cred.user).catch(function() {});
            }
          }).catch(function(e) { console.warn('[Auth] redirect result', e); });
        } catch (e) { console.warn('[Auth] redirect hook', e); }
        auth.onAuthStateChanged(async function(user) {'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_REQ in t:
        t = t.replace(OLD_REQ, NEW_REQ, 1)
    else:
        print('requestGoogleSignIn not exact', path)
    if OLD_SIGN in t:
        t = t.replace(OLD_SIGN, NEW_SIGN, 1)
    else:
        print('signInWithGoogle not exact', path)
    if OLD_AUTH in t and 'getRedirectResult' not in t:
        t = t.replace(OLD_AUTH, NEW_AUTH, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
