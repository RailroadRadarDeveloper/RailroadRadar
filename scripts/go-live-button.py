from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        '<button type="button" class="rr-btn" id="trip-log-save">Save trip</button>',
        '<button type="button" class="rr-btn" id="trip-log-save">Save trip</button>\n              <button type="button" class="rr-btn" id="trip-log-go-live" hidden>GO LIVE</button>',
        1,
    )
    if 'id="rr-go-live-css"' not in t:
        t = t.replace('</head>', '<style id="rr-go-live-css">#trip-log-go-live{background:#b00020;color:#fff;border:0;font-weight:800;letter-spacing:.04em}#trip-log-go-live[hidden]{display:none!important}body.trip-form-special #trip-log-save{display:none!important}body.trip-form-special #trip-log-go-live{display:inline-flex!important}</style>\n</head>', 1)
    js = '''
    document.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('#trip-log-go-live');
      if (!btn) return;
      ev.preventDefault();
      var cb = document.getElementById('trip-log-special-move');
      if (cb) cb.checked = true;
      Promise.resolve(typeof saveTripLog === 'function' ? saveTripLog() : null).then(function() {
        var user = (typeof rrAuthUser === 'function') ? rrAuthUser() : (typeof currentUser !== 'undefined' ? currentUser : null);
        if (user && user.uid) location.href = '/live/user.html?uid=' + encodeURIComponent(user.uid);
      }).catch(function() {});
    });
'''
    if 'trip-log-go-live' in t and 'closest(\'#trip-log-go-live\')' not in t:
        t = t.replace('</body>', '<script>' + js + '</script>\n</body>', 1)
        print('wired', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
