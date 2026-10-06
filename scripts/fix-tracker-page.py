from pathlib import Path
import re
index = Path('index.html').read_text(encoding='utf-8', errors='replace')
m = re.search(r'src="(data:image/png;base64,[^"]+)"[^>]*class="header-logo"', index)
logo = m.group(1) if m else '/assets/logo.png'
user = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Live tracker · RailroadRadar</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body {{ margin: 0; height: 100%; background: #07093e; color: #fff; font-family: sans-serif; }}
    header {{ height: 60px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 16px; background: #07093e; position: relative; z-index: 10000; }}
    header a {{ color: #fff; font-weight: 800; text-decoration: none; display: flex; align-items: center; }}
    header img {{ height: 40px; width: auto; display: block; }}
    #map {{ position: fixed; top: 60px; left: 0; right: 0; bottom: 0; background: #d7dde6; }}
    #status {{ font-size: 14px; }}
    .rr-live-train {{ background: transparent !important; border: 0 !important; }}
  </style>
</head>
<body>
  <header>
    <a href="/"><img src="{logo}" alt="RailroadRadar"></a>
    <span id="status">Loading tracker</span>
  </header>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
  <script>
    var uid = new URLSearchParams(location.search).get('uid') || '';
    firebase.initializeApp({{
      apiKey: 'AIzaSyBCXgIwkKHBrNfs4-0T0L9LQNb6GP-37Qs',
      authDomain: 'railroadradar-accounts.firebaseapp.com',
      projectId: 'railroadradar-accounts',
      storageBucket: 'railroadradar-accounts.firebasestorage.app',
      messagingSenderId: '896370923309',
      appId: '1:896370923309:web:594b0a20d3b1c6822e65a4'
    }});
    var map = L.map('map').setView([42.36, -71.06], 8);
    L.tileLayer('https://railroadradar-proxy.railroadradar.workers.dev/api/mapbox/styles/v1/northeastamtrakrailfanalt/ckyq285h5219a14mpql9jt2r7/tiles/256/{{z}}/{{x}}/{{y}}', {{
      attribution: '',
      maxZoom: 20
    }}).addTo(map);
    var marker = null;
    function icon(heading) {{
      var rot = isFinite(Number(heading)) ? Number(heading) : 90;
      return L.divIcon({{ className: 'rr-live-train', html: '<img src="/assets/hsp46.png" alt="" style="width:46px;height:20px;object-fit:contain;transform:rotate(' + rot + 'deg);display:block;">', iconSize: [46, 20], iconAnchor: [23, 10] }});
    }}
    if (!uid) {{
      document.getElementById('status').textContent = 'No tracker selected';
    }} else {{
      firebase.firestore().collection('specialMoveShares').doc(uid).onSnapshot(function(doc) {{
        var d = doc.exists ? (doc.data() || {{}}) : null;
        var live = d && d.active === true && Number(d.expiresAt) > Date.now() && isFinite(Number(d.lat)) && isFinite(Number(d.lon));
        if (!live) {{
          document.getElementById('status').textContent = 'Tracker is not live';
          if (marker) {{ map.removeLayer(marker); marker = null; }}
          return;
        }}
        var title = String(d.title || 'Live trip');
        document.title = title + ' \u00b7 RailroadRadar';
        document.getElementById('status').textContent = title;
        var ll = [Number(d.lat), Number(d.lon)];
        if (!marker) marker = L.marker(ll, {{ icon: icon(d.heading) }}).addTo(map);
        else {{ marker.setLatLng(ll); marker.setIcon(icon(d.heading)); }}
        if (!marker._rrFollowed) {{ map.setView(ll, 14); marker._rrFollowed = true; }}
      }}, function() {{
        document.getElementById('status').textContent = 'Could not load this tracker';
      }});
    }}
  </script>
  <script src="/assets/js/live-share-bar.js"></script>
</body>
</html>
'''
Path('live/user.html').write_text(user, encoding='utf-8')
print('user page', len(user))
start = '''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/">
<script>
try {
  var raw = localStorage.getItem('rrSpecialMoveShareV1');
  var stopped = localStorage.getItem('rrSpecialShareStopped') === '1';
  var o = raw ? JSON.parse(raw) : null;
  if (!stopped && o && o.uid && Number(o.expiresAt) > Date.now()) location.replace('/live/user.html?uid=' + encodeURIComponent(o.uid));
  else location.replace('/');
} catch (e) { location.replace('/'); }
</script></head><body></body></html>
'''
Path('live/index.html').write_text(start, encoding='utf-8')
print('live index redirected')

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        "if (user && user.uid) location.href = '/live/user.html?uid=' + encodeURIComponent(user.uid);",
        "var liveUser = user || window.currentUser || (window.firebase && firebase.auth && firebase.auth().currentUser);\n        if (liveUser && liveUser.uid) location.href = '/live/user.html?uid=' + encodeURIComponent(liveUser.uid);\n        else alert('Sign in before going live.');",
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('redirect', path)
patch('index.html')
patch('mytrips/index.html')
