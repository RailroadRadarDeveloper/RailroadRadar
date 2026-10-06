from pathlib import Path

def patch_user():
    p = Path('live/user.html')
    t = p.read_text(encoding='utf-8')
    if 'id="live-stats"' not in t:
        t = t.replace(
            '#map { position: fixed; top: 60px; left: 0; right: 0; bottom: 0; background: #d7dde6; }',
            '#live-stats { position: fixed; top: 60px; left: 0; right: 0; z-index: 9000; display: flex; gap: 18px; padding: 10px 16px; background: #07093e; color: #fff; font-size: 14px; font-weight: 700; }\n    #map { position: fixed; top: 104px; left: 0; right: 0; bottom: 0; background: #d7dde6; }',
            1,
        )
        t = t.replace(
            '<div id="map"></div>',
            '<div id="live-stats"><span id="live-speed">Speed --</span><span id="live-place">Location --</span></div>\n  <div id="map"></div>',
            1,
        )
    js = '''
        var mph = d.speed == null ? null : Math.round(Number(d.speed) * 2.23694);
        document.getElementById('live-speed').textContent = mph == null || !isFinite(mph) ? 'Speed --' : ('Speed ' + Math.max(0, mph) + ' mph');
        placeFor(Number(d.lat), Number(d.lon));
'''
    if 'placeFor' not in t:
        t = t.replace(
            "document.getElementById('status').textContent = title;",
            "document.getElementById('status').textContent = title;\n" + js,
            1,
        )
        t = t.replace(
            'var marker = null;',
            '''var marker = null;
    var placeKey = '';
    function placeFor(lat, lon) {
      var key = lat.toFixed(2) + ',' + lon.toFixed(2);
      if (key === placeKey) return;
      placeKey = key;
      fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lon)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var a = data.address || {};
          var town = a.village || a.town || a.city || a.hamlet || a.municipality || '';
          var state = a.state || '';
          document.getElementById('live-place').textContent = town && state ? (town + ', ' + state) : (data.display_name || 'Location unavailable');
        }).catch(function() {
          document.getElementById('live-place').textContent = 'Location unavailable';
        });
    }''',
            1,
        )
    p.write_text(t, encoding='utf-8')
    print('user', 'live-stats' in t)

def patch_bar():
    p = Path('assets/js/live-share-bar.js')
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        'lat: coords.latitude, lon: coords.longitude, heading: coords.heading, startedAt:',
        'lat: coords.latitude, lon: coords.longitude, heading: coords.heading, speed: coords.speed, startedAt:',
    )
    p.write_text(t, encoding='utf-8')
    print('bar speed', 'speed: coords.speed' in t)

patch_user()
patch_bar()
