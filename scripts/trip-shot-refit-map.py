from pathlib import Path

OLD_FIT = '''        if (bounds.length >= 2) {
          map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 12);'''

NEW_FIT = '''        map._rrTripBounds = bounds.slice();
        if (bounds.length >= 2) {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12, animate: false });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 11);'''

OLD_WAIT = '''      try { if (tripDetailMap) tripDetailMap.invalidateSize(false); } catch (_) {}
      await new Promise(function(r) { setTimeout(r, 220); });
      try { if (tripDetailMap) tripDetailMap.invalidateSize(false); } catch (_) {}'''

NEW_WAIT = '''      function rrRefitTripShot() {
        if (!tripDetailMap) return;
        try { tripDetailMap.invalidateSize(false); } catch (_) {}
        try {
          const b = tripDetailMap._rrTripBounds;
          if (b && b.length >= 2) {
            tripDetailMap.fitBounds(b, { padding: [32, 32], maxZoom: 11, animate: false });
          }
        } catch (_) {}
      }
      rrRefitTripShot();
      await new Promise(function(r) { setTimeout(r, 180); });
      rrRefitTripShot();
      await new Promise(function(r) { setTimeout(r, 160); });'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_FIT in t:
        t = t.replace(OLD_FIT, NEW_FIT, 1)
    if OLD_WAIT in t:
        t = t.replace(OLD_WAIT, NEW_WAIT, 1)
    else:
        print('wait block missing', path)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
