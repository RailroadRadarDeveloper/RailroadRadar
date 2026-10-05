from pathlib import Path
rules = Path('firestore.rules')
t = rules.read_text(encoding='utf-8')
block = '''
    match /specialMoveShares/{uid} {
      allow read: if true;
      allow create, update: if signedIn()
        && request.auth.uid == uid
        && request.resource.data.uid == uid
        && request.resource.data.active == true
        && request.resource.data.lat is number
        && request.resource.data.lon is number;
      allow delete: if signedIn() && request.auth.uid == uid;
    }
'''
if 'match /specialMoveShares/' not in t:
    t = t.replace('    match /accounts/{uid} {', block + '    match /accounts/{uid} {', 1)
    rules.write_text(t, encoding='utf-8')
    print('rules added')
else:
    print('rules exist')
live = Path('live/index.html')
html = live.read_text(encoding='utf-8')
old = "L.tileLayer('https://railroadradar-proxy.railroadradar.workers.dev/api/mapbox/styles/v1/northeastamtrakrailfanalt/ckyq285h5219a14mpql9jt2r7/tiles/256/{z}/{x}/{y}', {\n      attribution: '\\u00a9 Mapbox \\u00a9 OpenStreetMap contributors',\n      maxZoom: 20\n    }).addTo(map);"
new = "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {\n      attribution: '\\u00a9 OpenStreetMap',\n      maxZoom: 19,\n      subdomains: 'abc'\n    }).addTo(map);"
if old in html:
    html = html.replace(old, new, 1)
    print('tiles swapped')
else:
    html = html.replace(
        "L.tileLayer('https://railroadradar-proxy.railroadradar.workers.dev/api/mapbox/styles/v1/northeastamtrakrailfanalt/ckyq285h5219a14mpql9jt2r7/tiles/256/{z}/{x}/{y}'",
        "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'",
        1,
    )
    html = html.replace("attribution: '\\u00a9 Mapbox \\u00a9 OpenStreetMap contributors'", "attribution: '\\u00a9 OpenStreetMap'")
    print('tiles partial')
live.write_text(html, encoding='utf-8')
