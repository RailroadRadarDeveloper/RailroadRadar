from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

old='''      function rrDrawScheduledRoute(stops) {
        rrClearScheduledLine();
        if (!map || typeof L === 'undefined') return;
        const pts = (stops || []).filter(s => s && s.lat != null && s.lng != null).map(s => [Number(s.lat), Number(s.lng)]).filter(p => isFinite(p[0]) && isFinite(p[1]));
        if (pts.length < 2) return;
        rrScheduledLine = L.polyline(pts, { color: '#0ac700', weight: 5, opacity: 0.95 }).addTo(map);
        try { map.fitBounds(rrScheduledLine.getBounds(), { padding: [36, 36], maxZoom: 13 }); } catch (e) {}
      }'''

new='''      async function rrDrawScheduledRoute(stops, tripId) {
        rrClearScheduledLine();
        if (!map || typeof L === 'undefined') return;
        let pts = null;
        if (tripId) {
          try {
            const res = await fetch(apiUrl('/api/mbta' + '/trips/' + encodeURIComponent(tripId) + '?include=shape'));
            const data = await res.json();
            let poly = null;
            if (data && data.included) {
              const sh = data.included.find(function(x) { return x && x.type === 'shape'; });
              if (sh && sh.attributes && sh.attributes.polyline) poly = sh.attributes.polyline;
            }
            if (!poly && data && data.data && data.data.relationships && data.data.relationships.shape && data.data.relationships.shape.data) {
              const sid = data.data.relationships.shape.data.id;
              const sr = await fetch(apiUrl('/api/mbta' + '/shapes/' + encodeURIComponent(sid)));
              const sd = await sr.json();
              if (sd && sd.data && sd.data.attributes && sd.data.attributes.polyline) poly = sd.data.attributes.polyline;
            }
            if (poly && L.Polyline && typeof L.Polyline.fromEncoded === 'function') {
              pts = L.Polyline.fromEncoded(poly).getLatLngs();
            }
          } catch (e) {}
        }
        if (!pts || pts.length < 2) {
          pts = (stops || []).filter(s => s && s.lat != null && s.lng != null).map(s => [Number(s.lat), Number(s.lng)]).filter(p => isFinite(p[0]) && isFinite(p[1]));
        }
        if (!pts || pts.length < 2) return;
        rrScheduledLine = L.polyline(pts, { color: '#0ac700', weight: 5, opacity: 0.95 }).addTo(map);
        try { map.fitBounds(rrScheduledLine.getBounds(), { padding: [36, 36], maxZoom: 13 }); } catch (e) {}
      }'''

if old not in t:
    raise SystemExit('rrDrawScheduledRoute not found')
t=t.replace(old,new,1)

t=t.replace('rrDrawScheduledRoute(page.stops);', 'rrDrawScheduledRoute(page.stops, page.tid);', 1)

p.write_text(t, encoding='utf-8')
print('shape-based scheduled route')
