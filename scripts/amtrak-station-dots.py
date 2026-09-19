from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

# Harvest stations from every Amtrak train after the live-marker pass.
needle = '''          Object.keys(amtrakMarkers).forEach(function(vid) {
            if (!seen.has(vid)) {
              map.removeLayer(amtrakMarkers[vid]);
              delete amtrakMarkers[vid];
              delete amtrakTrainInfo[vid];
              delete amtrakLastSeen[vid];
            }
          });
          FetchStats.end(stat, {'''
insert = '''          Object.keys(amtrakMarkers).forEach(function(vid) {
            if (!seen.has(vid)) {
              map.removeLayer(amtrakMarkers[vid]);
              delete amtrakMarkers[vid];
              delete amtrakTrainInfo[vid];
              delete amtrakLastSeen[vid];
            }
          });
          try {
            (amtrakAllTrains || []).forEach(function(tr) { harvestAmtrakStationDots(tr); });
            if (typeof updateStationVisibility === 'function') updateStationVisibility();
          } catch (_) {}
          FetchStats.end(stat, {'''
if needle not in t:
    raise SystemExit('amtrak cleanup block not found')
if 'amtrakAllTrains || []).forEach(function(tr) { harvestAmtrakStationDots' not in t:
    t = t.replace(needle, insert, 1)

# Also harvest before GPS skip so pre-departure trains contribute station coords.
old='amtrakAllTrains.push(t);\n              if (!t || t.lat == null || t.lon == null) { skipped++; return; }'
new='amtrakAllTrains.push(t);\n              try { harvestAmtrakStationDots(t); } catch (_) {}\n              if (!t || t.lat == null || t.lon == null) { skipped++; return; }'
if old in t and t.count('harvestAmtrakStationDots(t)') < 3:
    t=t.replace(old,new,1)

p.write_text(t, encoding='utf-8')
print('amtrak station harvest expanded')
