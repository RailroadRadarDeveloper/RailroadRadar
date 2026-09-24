from pathlib import Path

OLD = '''    .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;'''

NEW = '''    .mytrips-guest[hidden] {
      display: none !important;
    }
    .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;'''

OLD_SHOW = '''    function showMyTripsGuestHome() {
      const el = document.getElementById('mytrips-guest');
      if (el) el.hidden = false;'''

NEW_SHOW = '''    function showMyTripsGuestHome() {
      if (currentUser || (typeof auth !== 'undefined' && auth && auth.currentUser)) {
        hideMyTripsGuestHome();
        return;
      }
      const el = document.getElementById('mytrips-guest');
      if (el) el.hidden = false;'''

OLD_TICK = '''          if (currentUser) {
            openTripLogModal(null, { tab: 'list', forceModal: true });
            return;
          }'''

NEW_TICK = '''          if (currentUser || (auth && auth.currentUser)) {
            hideMyTripsGuestHome();
            openTripLogModal(null, { tab: 'list', forceModal: true });
            return;
          }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
    if OLD_SHOW in t:
        t = t.replace(OLD_SHOW, NEW_SHOW, 1)
    if OLD_TICK in t:
        t = t.replace(OLD_TICK, NEW_TICK, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
