from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

# New Amtrak train markers: no popup
t = t.replace(
    'm.bindPopup(createAmtrakPopupContent(vid, info), rrPopupOpts());',
    '/* Amtrak popups disabled */',
)

# Don't refresh Amtrak popup content
old_upd = '''                if (amtrakMarkers[vid].getPopup()) {
                  amtrakMarkers[vid].setPopupContent(createAmtrakPopupContent(vid, info));
                }'''
if old_upd in t:
    t = t.replace(old_upd, '')
else:
    t = t.replace('amtrakMarkers[vid].setPopupContent(createAmtrakPopupContent(vid, info));', '')

# Agency station dots: skip popup for Amtrak only
old_bind = "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');"
new_bind = "if (a !== 'amtrak') { m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>'); }"
if old_bind in t:
    t = t.replace(old_bind, new_bind)

p.write_text(t, encoding='utf-8')
print('amtrak popups removed',
      'createAmtrakPopupContent(vid, info), rrPopupOpts()' not in t)
