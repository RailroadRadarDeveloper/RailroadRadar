from pathlib import Path

BAR = '''
<style id="rr-live-bar-css">
  #rr-live-bar { position: sticky; top: 60px; z-index: 10030; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #b00020; color: #fff; padding: 10px 16px; font-size: 14px; font-weight: 700; }
  #rr-live-bar[hidden] { display: none !important; }
  #rr-live-bar button { background: #fff; color: #b00020; border: 0; border-radius: 999px; padding: 6px 12px; font-weight: 800; cursor: pointer; }
</style>
<script id="rr-live-bar-js">
(function() {
  var KEY = 'rrSpecialMoveShareV1';
  function read() {
    try {
      var raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.expiresAt || Date.now() >= Number(o.expiresAt)) {
        localStorage.removeItem(KEY);
        return null;
      }
      return o;
    } catch (e) { return null; }
  }
  function write(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function bar() {
    var el = document.getElementById('rr-live-bar');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'rr-live-bar';
    el.hidden = true;
    el.innerHTML = '<span id="rr-live-bar-text">Sharing location</span><button type="button" id="rr-live-bar-stop">Stop sharing</button>';
    var header = document.querySelector('.header');
    if (header && header.parentNode) header.parentNode.insertBefore(el, header.nextSibling);
    else document.body.appendChild(el);
    el.querySelector('#rr-live-bar-stop').addEventListener('click', function() {
      try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
      el.hidden = true;
      if (typeof rrSpecialStopSharing === 'function') rrSpecialStopSharing();
    });
    return el;
  }
  function show(o) {
    var el = bar();
    var ago = o.updatedAt ? Math.max(0, Math.round((Date.now() - Number(o.updatedAt)) / 1000)) : 0;
    var text = 'Sharing location on the live map';
    if (ago >= 10) text += ' \u00b7 updated ' + ago + 's ago';
    else text += ' \u00b7 live';
    el.querySelector('#rr-live-bar-text').textContent = text;
    el.hidden = false;
  }
  function tick() {
    var o = read();
    if (!o) { var el = document.getElementById('rr-live-bar'); if (el) el.hidden = true; return; }
    show(o);
  }
  function resume(o) {
    if (!navigator.geolocation || !navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then(function(p) {
      if (p.state !== 'granted') return;
      if (!window.rrSpecialShareState) window.rrSpecialShareState = o;
      navigator.geolocation.watchPosition(function(pos) {
        o.updatedAt = Date.now();
        o.lastLat = pos.coords.latitude;
        o.lastLon = pos.coords.longitude;
        write(o);
        show(o);
        if (typeof rrSpecialWriteShare === 'function') rrSpecialWriteShare(pos.coords, { force: false });
      }, function() {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    }).catch(function() {});
  }
  document.addEventListener('DOMContentLoaded', function() {
    tick();
    setInterval(tick, 10000);
    var o = read();
    if (o) resume(o);
  });
  var old = window.rrSpecialPersistLocal;
  window.rrSpecialPersistLocal = function(state) {
    if (typeof old === 'function') { try { old(state); } catch (e) {} }
    if (!state) { try { localStorage.removeItem(KEY); } catch (e) {} var el = document.getElementById('rr-live-bar'); if (el) el.hidden = true; return; }
    write({ uid: state.uid, tripId: state.tripId, title: state.title, startedAt: state.startedAt, expiresAt: state.expiresAt, updatedAt: Date.now() });
    show(read());
  };
})();
</script>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'id="rr-live-bar-js"' not in t:
        t = t.replace('</body>', BAR + '\n</body>', 1)
        print('bar', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
