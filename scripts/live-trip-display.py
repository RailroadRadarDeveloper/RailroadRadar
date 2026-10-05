from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        "if (routeEl) routeEl.innerHTML = tripRouteOdHtml(od.origin, od.dest);",
        '''if (routeEl) {
        const noStations = !od.origin || od.origin === '?' || !od.dest || od.dest === '?';
        const title = data.specialMove ? String(data.trainTitle || '').trim() : '';
        routeEl.textContent = (data.specialMove && noStations && title) ? title : '';
        if (!(data.specialMove && noStations && title)) routeEl.innerHTML = tripRouteOdHtml(od.origin, od.dest);
      }''',
        1,
    )
    t = t.replace(
        'const textRel = formatTripRelativeDepart(data || tripDetailRelativeData);',
        '''const d0 = data || tripDetailRelativeData;
      if (d0 && d0.specialMove) {
        el.hidden = false;
        el.textContent = 'Live trip';
        return;
      }
      const textRel = formatTripRelativeDepart(d0);''',
        1,
    )
    t = t.replace(
        ".trip-detail-map.is-empty::after {\n      content: 'Map unavailable';",
        ".trip-detail-map.is-empty::after {\n      content: 'Map unavailable';",
        1,
    )
    if 'is-live-empty::after' not in t:
        t = t.replace(
            ".trip-detail-map.is-empty::after {",
            ".trip-detail-map.is-live-empty::after { content: 'Location shows here while sharing'; }\n    .trip-detail-map.is-empty::after {",
            1,
        )
    t = t.replace(
        'if (!hasAny) {\n        el.classList.remove(\'is-loading\');\n        el.classList.add(\'is-empty\');\n        return;\n      }',
        '''if (!hasAny) {
        el.classList.remove('is-loading');
        if (data && data.specialMove && data.liveLat != null && data.liveLon != null) {
          try {
            const map = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
            rrTripMapTileLayer({ maxZoom: 20, opacity: 1 }).addTo(map);
            L.circleMarker([Number(data.liveLat), Number(data.liveLon)], { radius: 7, color: '#fff', weight: 2, fillColor: '#07093e', fillOpacity: 1 }).addTo(map);
            map.setView([Number(data.liveLat), Number(data.liveLon)], 13);
            el.classList.remove('is-empty');
            return;
          } catch (_) {}
        }
        el.classList.add(data && data.specialMove ? 'is-live-empty' : 'is-empty');
        return;
      }''',
        1,
    )
    t = t.replace(
        "if (el) el.textContent = 'Location allowed. You can share this move on the live map after saving.';",
        '''window.rrSpecialLastFix = { lat: arguments[0] && arguments[0].coords && arguments[0].coords.latitude, lon: arguments[0] && arguments[0].coords && arguments[0].coords.longitude };
        if (el) el.textContent = 'Location allowed. You can share this move on the live map after saving.';''',
        1,
    )
    # that arguments trick is wrong because it's not inside the callback properly. Fix below if needed.
    t = t.replace(
        'navigator.geolocation.getCurrentPosition(function() {\n        if (el) el.textContent = \'Location allowed. You can share this move on the live map after saving.\';',
        '''navigator.geolocation.getCurrentPosition(function(pos) {
        try {
          window.rrSpecialLastFix = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        } catch (_) {}
        if (el) el.textContent = 'Location allowed. You can share this move on the live map after saving.';''',
        1,
    )
    t = t.replace(
        'miles: Number(miles) || 0\n        };',
        '''miles: Number(miles) || 0
        };
        if (specialOpts && specialOpts.specialMove && window.rrSpecialLastFix && window.rrSpecialLastFix.lat != null) {
          segOut.liveLat = Number(window.rrSpecialLastFix.lat);
          segOut.liveLon = Number(window.rrSpecialLastFix.lon);
        }''',
        1,
    )
    # also copy onto payload if segments don't bubble liveLat. Search payload return.
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'Live trip', t.count('Live trip'))

patch('index.html')
patch('mytrips/index.html')
