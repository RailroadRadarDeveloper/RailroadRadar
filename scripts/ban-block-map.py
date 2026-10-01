from pathlib import Path

OLD_HTML_START = '<div id="rr-banned-screen"'
NEW_HTML = '''<div id="rr-banned-screen" hidden style="display:none;position:fixed;inset:0;z-index:2147483000;background:#07093e;color:#fff;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;">
    <div style="max-width:420px;width:100%;text-align:center;">
      <h2 style="margin:0 0 10px;font-size:22px;">Account banned</h2>
      <p id="rr-banned-reason" style="margin:0;font-size:15px;line-height:1.45;color:#d7d9ee;">This account cannot use RailroadRadar.</p>
    </div>
  </div>'''

OLD_FN = '''    function showBannedScreen(reason) {
      const wrap = document.getElementById('rr-banned-screen');
      const text = document.getElementById('rr-banned-reason');
      if (text) {
        text.textContent = reason
          ? ('This account is banned. Reason: ' + reason)
          : 'This account is banned and cannot sign in, submit reports, or save trips.';
      }
      if (wrap) {
        wrap.hidden = false;
        wrap.style.display = 'flex';
      } else {
        alert(reason ? ('This account is banned. Reason: ' + reason) : 'This account is banned.');
      }
    }
    (function wireBannedOk() {
      const btn = document.getElementById('rr-banned-ok');
      const wrap = document.getElementById('rr-banned-screen');
      if (btn && wrap) btn.addEventListener('click', function() {
        wrap.hidden = true;
        wrap.style.display = 'none';
      });
    })();'''

NEW_FN = '''    function showBannedScreen(reason) {
      const msg = reason
        ? ('This account is banned. Reason: ' + reason)
        : 'This account is banned and cannot use the map.';
      try { localStorage.setItem('rrBannedLock', msg); } catch (_) {}
      document.documentElement.classList.add('rr-banned');
      const mapEl = document.getElementById('map');
      if (mapEl) mapEl.style.display = 'none';
      const loading = document.getElementById('loading-screen');
      if (loading) loading.style.display = 'none';
      const wrap = document.getElementById('rr-banned-screen');
      const text = document.getElementById('rr-banned-reason');
      if (text) text.textContent = msg;
      if (wrap) {
        wrap.hidden = false;
        wrap.style.display = 'flex';
      }
    }
    (function restoreBannedLock() {
      try {
        const msg = localStorage.getItem('rrBannedLock');
        if (msg) showBannedScreen(msg.replace(/^This account is banned\\. Reason: /, '') === msg ? '' : msg.replace(/^This account is banned\\. Reason: /, ''));
      } catch (_) {}
    })();'''

EARLY = '''<script>
(function(){
  try {
    var msg = localStorage.getItem('rrBannedLock');
    if (!msg) return;
    document.documentElement.classList.add('rr-banned');
    var s = document.createElement('style');
    s.textContent = 'html.rr-banned #map, html.rr-banned .header, html.rr-banned #loading-screen { display:none !important; }';
    document.documentElement.appendChild(s);
  } catch (e) {}
})();
</script>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    start = t.find(OLD_HTML_START)
    if start >= 0:
        end = t.find('</div>', t.find('</div>', start) + 1)
        # two closing divs
        end = t.find('</div>', end + 1)
        if end > start:
            t = t[:start] + NEW_HTML + t[end+6:]
            print('html replaced', path)
        else:
            print('html end missing', path)
    else:
        print('html missing', path)
    if OLD_FN in t:
        t = t.replace(OLD_FN, NEW_FN, 1)
        print('fn replaced', path)
    else:
        print('fn missing', path)
    if 'rrBannedLock' not in t[:t.find('<body>')+20] and 'localStorage.getItem(\'rrBannedLock\')' not in t[:8000]:
        if '</head>' in t:
            t = t.replace('</head>', EARLY + '</head>', 1)
            print('early', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
