from pathlib import Path

HELPER = '''
    function rrLiveTripPoint(data) {
      if (!data) return null;
      if (data.liveLat != null && data.liveLon != null) return [Number(data.liveLat), Number(data.liveLon)];
      const segs = Array.isArray(data.segments) ? data.segments : [];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i] || {};
        if (s.liveLat != null && s.liveLon != null) return [Number(s.liveLat), Number(s.liveLon)];
      }
      try {
        const raw = localStorage.getItem('rrSpecialMoveShareV1');
        const o = raw ? JSON.parse(raw) : null;
        if (o && o.lastLat != null && o.lastLon != null) return [Number(o.lastLat), Number(o.lastLon)];
      } catch (e) {}
      if (window.rrSpecialLastFix && window.rrSpecialLastFix.lat != null) return [Number(window.rrSpecialLastFix.lat), Number(window.rrSpecialLastFix.lon)];
      return null;
    }
    function rrLiveTripTileLayer() {
      return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '' });
    }
'''

OLD = '''if (data && data.specialMove && data.liveLat != null && data.liveLon != null) {
          try {
            const map = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
            rrTripMapTileLayer({ maxZoom: 20, opacity: 1 }).addTo(map);
            L.circleMarker([Number(data.liveLat), Number(data.liveLon)], { radius: 7, color: '#fff', weight: 2, fillColor: '#07093e', fillOpacity: 1 }).addTo(map);
            map.setView([Number(data.liveLat), Number(data.liveLon)], 13);'''

NEW = '''const livePt = rrLiveTripPoint(data);
        if (data && data.specialMove && livePt) {
          try {
            const map = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
            rrLiveTripTileLayer().addTo(map);
            L.circleMarker(livePt, { radius: 7, color: '#fff', weight: 2, fillColor: '#b00020', fillOpacity: 1 }).addTo(map);
            map.setView(livePt, 13);
            setTimeout(function() { try { map.invalidateSize(); } catch (e) {} }, 200);'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function rrLiveTripPoint' not in t:
        t = t.replace('function paintTripLogMiniMap(el, data) {', HELPER + '    function paintTripLogMiniMap(el, data) {', 1)
        print('helper', path)
    t = t.replace(OLD, NEW)
    p.write_text(t, encoding='utf-8')
    print('maps', path, t.count('rrLiveTripPoint'))

patch('index.html')
patch('mytrips/index.html')
