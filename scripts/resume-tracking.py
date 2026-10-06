from pathlib import Path
p = Path('assets/js/live-share-bar.js')
t = p.read_text(encoding='utf-8')
old = '''    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
      if (!stopped() && p.state === 'granted') startWatch(read());
    }).catch(function () {});
  }'''
new = '''    startWatch(read());
    setInterval(function () {
      var cur = read();
      if (!cur || stopped() || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (stopped()) return;
        cur.updatedAt = Date.now();
        write(cur);
        show(cur);
        publish(cur, pos.coords);
      }, function () {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 });
    }, 5000);
  }'''
if old not in t:
    raise SystemExit('boot block missing')
t = t.replace(old, new, 1)
t = t.replace(
'''    }, function () {
      window.__rrLiveWatch = 0;
      show(o);
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });''',
'''    }, function (err) {
      if (err && err.code === 1) {
        window.__rrLiveWatch = 0;
        show(o);
      }
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });'''
)
p.write_text(t, encoding='utf-8')
print('resumes on refresh')
