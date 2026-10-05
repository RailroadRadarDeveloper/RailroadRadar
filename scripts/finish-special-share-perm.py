from pathlib import Path

OLD_BOUNDS = '''      const bounds = [];
      /* Trip transfer dots */
      segs.forEach(function(g) {
        if (g.line && g.line.length >= 2) {'''

NEW_BOUNDS = '''      const bounds = [];
      /* RR special-move no route line 2026-10-05 */
      /* Special move / extra: OD dots only */
      var odOnly = !!(data && (data.specialMove === true || data.specialMove === 'true'));
      /* Trip transfer dots */
      segs.forEach(function(g) {
        if (!odOnly && g.line && g.line.length >= 2) {'''

OLD_SHARE = "const sharing = !!(rrSpecialShareState && (rrSpecialShareWatchId != null || rrSpecialShareState.lastWriteAt));"
NEW_SHARE = "/* RR special-move share permission 2026-10-05 */\n      /* Sharing is ON only after a successful geo fix */\n      const sharing = !!(rrSpecialShareState && rrSpecialShareState.lastWriteAt);"

OLD_ERR = '''        if (err && err.code === 1) {
          rrSpecialSetShareStatus('Location permission denied. Allow location for RailroadRadar in browser/site settings, then tap Share again.', true);
          rrSpecialClearWatch();
          rrSpecialClearDetailMarker();
          rrSpecialShareState = null;
          rrSpecialShareQueue = [];
          rrSpecialPersistLocal(null);
          rrSpecialUpdateShareButtons();
          if (startBtn) startBtn.disabled = false;
          return;
        }'''

NEW_ERR = '''        if (err && err.code === 1) {
          rrSpecialSetShareStatus('Location permission denied. Allow location for RailroadRadar in browser/site settings, then tap Share again.', true);
          if (typeof rrSpecialAbortPendingShare === 'function') rrSpecialAbortPendingShare();
          if (startBtn) startBtn.disabled = false;
          return;
        }'''

ABORT = '''
    var rrSpecialSharePending = false;
    function rrSpecialAbortPendingShare() {
      rrSpecialSharePending = false;
      try { rrSpecialClearWatch(); } catch (_) {}
      try { rrSpecialClearDetailMarker(); } catch (_) {}
      rrSpecialShareState = null;
      rrSpecialShareQueue = [];
      try { rrSpecialPersistLocal(null); } catch (_) {}
      try { rrSpecialUpdateShareButtons(); } catch (_) {}
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    n = t.count(OLD_BOUNDS)
    t = t.replace(OLD_BOUNDS, NEW_BOUNDS)
    t = t.replace('} else if (g.origin && g.dest) {', '} else if (!odOnly && g.origin && g.dest) {')
    if OLD_SHARE in t:
        t = t.replace(OLD_SHARE, NEW_SHARE, 1)
    if OLD_ERR in t:
        t = t.replace(OLD_ERR, NEW_ERR, 1)
    if 'function rrSpecialAbortPendingShare' not in t:
        t = t.replace('    function rrSpecialUpdateShareButtons', ABORT + '    function rrSpecialUpdateShareButtons', 1)
    needle = '          if (rrNearbyAskedGeo) return;'
    if needle in t and 'Never auto-request geolocation on /mytrips' not in t:
        t = t.replace(needle, "          /* Never auto-request geolocation on /mytrips */\n          /* never auto-grant geo on /mytrips */\n          if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) return;\n" + needle, 1)
    p.write_text(t, encoding='utf-8')
    print(path, 'bounds', n, 'pending', 'rrSpecialAbortPendingShare' in t, 'odOnly', t.count('odOnly'))

patch('index.html')
patch('mytrips/index.html')
