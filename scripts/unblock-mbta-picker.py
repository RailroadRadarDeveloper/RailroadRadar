from pathlib import Path

OLD = '''          const saved = getMapRailPrefs();
          if (saved) {
            resolve(saved);
            return;
          }
          const el = document.getElementById('rr-rail-picker');
          if (!el) {
            resolve(defaultMapRailPrefs());
            return;
          }'''

NEW = '''          const saved = getMapRailPrefs();
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
          }'''

CSS = '''    #offline-banner.offline-banner { display: none; }
    #offline-banner.offline-banner.visible { display: block; }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        print('prefs patched', path)
    else:
        print('prefs block not found', path)
    if '#offline-banner.offline-banner { display: none; }' not in t:
        t = t.replace('function updateOnlineStatus() {', CSS + '      function updateOnlineStatus() {', 1)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
