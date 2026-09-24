from pathlib import Path

HELPER = '''    function rrAuthUser() {
      try {
        if (currentUser) return currentUser;
        if (typeof auth !== 'undefined' && auth && auth.currentUser) {
          currentUser = auth.currentUser;
          return currentUser;
        }
      } catch (_) {}
      return null;
    }
'''

OLD = '''      if (!currentUser) {
        if (typeof showNotification === 'function') showNotification('Sign in to open Trip log.', 'error');
        if (typeof openSignupPrompt === 'function') openSignupPrompt(true);
        return;
      }'''

NEW = '''      if (!rrAuthUser()) {
        if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) {
          try { showMyTripsGuestHome(); } catch (_) {}
          return;
        }
        if (typeof showNotification === 'function') showNotification('Sign in to open Trip log.', 'error');
        if (typeof openSignupPrompt === 'function') openSignupPrompt(true);
        return;
      }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function rrAuthUser()' not in t:
        t = t.replace('    function openTripLogModal(e, opts) {', HELPER + '    function openTripLogModal(e, opts) {', 1)
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
    else:
        print('openTripLogModal check missing', path)
    # load trips auth check
    t = t.replace(
        "if (!currentUser) {\n        setTripLogError('Sign in to view trips.');",
        "if (!rrAuthUser()) {\n        setTripLogError('Sign in to view trips.');",
    )
    t = t.replace(
        "if (!currentUser) {\n        setTripLogError('Sign in to log a trip.');",
        "if (!rrAuthUser()) {\n        setTripLogError('Sign in to log a trip.');",
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
