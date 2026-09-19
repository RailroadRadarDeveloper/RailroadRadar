from pathlib import Path
js = Path('scripts/amtrak-station-board.js').read_text(encoding='utf-8')
p = Path('index.html')
t = p.read_text(encoding='utf-8')

if 'function getCombinedStationDepartures' not in t:
    needle = '      function createStationPopupContent(name, ids, deps, n) {'
    if needle not in t:
        raise SystemExit('createStationPopupContent missing')
    t = t.replace(needle, js + needle, 1)

# Keep every Amtrak train, including those without GPS yet.
old_skip = 'if (!t || t.lat == null || t.lon == null) { skipped++; return; }'
new_skip = '''if (!amtrakAllTrains) amtrakAllTrains = [];
              amtrakAllTrains.push(t);
              if (!t || t.lat == null || t.lon == null) { skipped++; return; }'''
if old_skip in t and 'amtrakAllTrains.push(t)' not in t:
    t = t.replace(old_skip, new_skip, 1)
# reset cache each fetch
if 'amtrakAllTrains = [];' not in t[t.find('function fetchAmtrakTrains'):t.find('function fetchAmtrakTrains')+800]:
    t = t.replace(
        'const now = Date.now();\n          let created = 0, updated = 0, skipped = 0, filtered = 0;',
        'const now = Date.now();\n          amtrakAllTrains = [];\n          let created = 0, updated = 0, skipped = 0, filtered = 0;',
        1,
    )

# MBTA popup uses combined list
t = t.replace(
    'const deps = await getStationDepartures(g.stopIds);',
    'm._rrStation = { name: g.name, mbtaIds: g.stopIds, lat: g.lat, lng: g.lng }; const deps = await getCombinedStationDepartures(m._rrStation);',
    1,
)

# Amtrak placeholder popup -> load combined list
old_bind = "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');"
new_bind = "m._rrStation = { name: title, amtrakCode: a === 'amtrak' ? String(sid) : '', lat: latN, lng: lngN }; m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><div class=\"loading-departures\">Loading departures...</div></div>'); m.on('popupopen', async function() { const deps = await getCombinedStationDepartures(m._rrStation); if (m.getPopup) m.getPopup().setContent(createStationPopupContent(title, [key], deps, 1)); });"
if old_bind in t:
    t = t.replace(old_bind, new_bind, 1)

# Agency tag on rows
t = t.replace(
    '<span class=\"departure-destination\">${d.destination || d.routeName}',
    '<span class=\"departure-destination\"><small>${d.agency === \'amtrak\' ? \'Amtrak\' : \'MBTA\'}</small> ${d.destination || d.routeName}',
    1,
)

p.write_text(t, encoding='utf-8')
print('board patched', 'getCombinedStationDepartures' in t, 'amtrakAllTrains.push' in t)
