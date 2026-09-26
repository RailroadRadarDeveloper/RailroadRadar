from pathlib import Path

OLD = '''          if (rrIsShareDeepLink()) {
            resolve(prefsForShareDeepLink());
            return;
          }
          const saved = getMapRailPrefs();
          function prefsAreUsable(p) {
            if (!p || typeof p !== 'object') return false;
            return RR_MAP_RAIL_IDS.some(function(id) { return !!p[id]; });
          }
          if (prefsAreUsable(saved)) {
            resolve(saved);
            return;
          }
          // Never block the map waiting for the picker. Load defaults now.
          resolve(defaultMapRailPrefs());
          const el = document.getElementById('rr-rail-picker');
          if (!el) {
            return;
          }
          syncPickerDom(defaultMapRailPrefs());'''

NEW = '''          if (rrIsShareDeepLink()) {
            resolve(prefsForShareDeepLink());
            return;
          }
          if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) {
            resolve(defaultMapRailPrefs());
            return;
          }
          const saved = getMapRailPrefs();
          const el = document.getElementById('rr-rail-picker');
          if (!el) {
            resolve((saved && RR_MAP_RAIL_IDS.some(function(id) { return !!saved[id]; })) ? saved : defaultMapRailPrefs());
            return;
          }
          syncPickerDom((saved && typeof saved === 'object') ? saved : defaultMapRailPrefs());'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        print('replaced', path)
    else:
        print('block missing', path)
        print('has share check', 'if (rrIsShareDeepLink())' in t[t.find('function promiseMapRailPrefs'):t.find('function promiseMapRailPrefs')+400])
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
