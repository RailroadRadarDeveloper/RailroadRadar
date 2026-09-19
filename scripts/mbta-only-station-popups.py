from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

# Do not bind a popup on Amtrak station dots
old = "        m._rrStation = { name: title, amtrakCode: a === 'amtrak' ? String(sid) : '', lat: latN, lng: lngN }; m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');"
new = "        m._rrStation = { name: title, amtrakCode: a === 'amtrak' ? String(sid) : '', lat: latN, lng: lngN };\n        if (a !== 'amtrak') {\n          m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');\n        }"
if old in t:
    t = t.replace(old, new, 1)
elif "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');" in t:
    t = t.replace(
        "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');",
        "if (a !== 'amtrak') { m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>'); }",
        1,
    )
else:
    raise SystemExit('bindPopup line not found')

# MBTA station boards should not mix in Amtrak rows
t = t.replace(
    'm._rrStation = { name: g.name, mbtaIds: g.stopIds, lat: g.lat, lng: g.lng }; const deps = await getCombinedStationDepartures(m._rrStation);',
    'const deps = await getStationDepartures(g.stopIds);',
    1,
)

p.write_text(t, encoding='utf-8')
print('amtrak station popups removed')
