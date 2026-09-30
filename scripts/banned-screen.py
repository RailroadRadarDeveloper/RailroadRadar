from pathlib import Path

HTML = '''  <div id="rr-banned-screen" hidden style="display:none;position:fixed;inset:0;z-index:10050;background:rgba(7,9,62,.72);align-items:center;justify-content:center;padding:20px;box-sizing:border-box;">
    <div style="max-width:420px;width:100%;background:#fff;color:#07093e;border-radius:10px;padding:22px 20px;text-align:center;box-shadow:0 16px 40px rgba(0,0,0,.28);">
      <h2 style="margin:0 0 8px;font-size:20px;">Account banned</h2>
      <p id="rr-banned-reason" style="margin:0 0 16px;font-size:14px;line-height:1.4;">This account cannot use RailroadRadar.</p>
      <button type="button" id="rr-banned-ok" style="background:#07093e;color:#fff;border:0;border-radius:6px;padding:10px 16px;font-size:14px;cursor:pointer;">OK</button>
    </div>
  </div>
'''

JS = '''
    function showBannedScreen(reason) {
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
    })();
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'id="rr-banned-screen"' not in t:
        if '<div class="header">' in t:
            t = t.replace('<div class="header">', HTML + '<div class="header">', 1)
        else:
            t = t.replace('<body>', '<body>\n' + HTML, 1)
        print('html', path)
    if 'function showBannedScreen' not in t:
        t = t.replace('    async function checkUserBanned(user) {', JS + '    async function checkUserBanned(user) {', 1)
        print('js', path)
    t = t.replace(
        "if (typeof showNotification === 'function') showNotification('This account is banned.' + why);\n                  else alert('This account is banned.' + why);",
        "if (typeof showBannedScreen === 'function') showBannedScreen(ban.reason || '');\n                  else if (typeof showNotification === 'function') showNotification('This account is banned.' + why);\n                  else alert('This account is banned.' + why);",
        1,
    )
    t = t.replace(
        "setTripLogError('This account is banned' + (ban.reason ? (': ' + ban.reason) : '.'));",
        "setTripLogError('This account is banned' + (ban.reason ? (': ' + ban.reason) : '.'));\n            if (typeof showBannedScreen === 'function') showBannedScreen(ban.reason || '');",
        1,
    )
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
