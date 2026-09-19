from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

old = "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');"
new = "if (a !== 'amtrak') { m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>'); }"
count = t.count(old)
if count < 1:
    raise SystemExit('station bindPopup not found')
# Only the agency-dot helper should lose Amtrak popups.
start = t.find('function upsertAgencyStationDot')
end = t.find('function plotStaticAgencyStationDots')
block = t[start:end]
if old not in block:
    raise SystemExit('bindPopup not in upsertAgencyStationDot')
block2 = block.replace(old, new, 1)
t = t[:start] + block2 + t[end:]
p.write_text(t, encoding='utf-8')
print('patched upsert, occurrences were', count)
