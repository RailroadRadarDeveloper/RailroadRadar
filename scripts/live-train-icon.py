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
      if (window.rrSpecialLastFix && window.rrSpecialLastFix.lat != null) return [Number(window.rrSpecialLastFix.lat), Number(window.rrSpecialLastFix.lon)];
      return null;
    }
    function rrLiveTrainIcon(heading) {
      const rot = isFinite(Number(heading)) ? Number(heading) : 90;
      return L.divIcon({
        className: 'rr-live-train-icon',
        html: '<img src="/assets/hsp46.png" alt="" style="width:46px;height:20px;object-fit:contain;transform:rotate(' + rot + 'deg);display:block;">',
        iconSize: [46, 20],
        iconAnchor: [23, 10]
      });
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function rrLiveTripPoint' not in t:
        t = t.replace('function paintTripLogMiniMap(el, data) {', HELPER + '    function paintTripLogMiniMap(el, data) {', 1)
    t = t.replace(
        'if (data && data.specialMove && data.liveLat != null && data.liveLon != null) {',
        'const livePt = rrLiveTripPoint(data);\n        if (data && data.specialMove && livePt) {',
    )
    t = t.replace(
        'L.circleMarker([Number(data.liveLat), Number(data.liveLon)], { radius: 7, color: \'#fff\', weight: 2, fillColor: \'#07093e\', fillOpacity: 1 }).addTo(map);',
        'L.marker(livePt, { icon: rrLiveTrainIcon(data.heading) }).addTo(map);',
    )
    t = t.replace('map.setView([Number(data.liveLat), Number(data.liveLon)], 13);', 'map.setView(livePt, 13);')
    if 'rr-live-train-icon' not in t:
        t = t.replace('</head>', '<style>.rr-live-train-icon{background:transparent;border:0}</style>\n</head>', 1)
    p.write_text(t, encoding='utf-8')
    print(path, 'icon', t.count('rrLiveTrainIcon'), 'point', t.count('rrLiveTripPoint'))

patch('index.html')
patch('mytrips/index.html')
user = Path('live/user.html')
u = user.read_text(encoding='utf-8')
u = u.replace(
    "html: '<img src=\"/assets/hsp46.png\" alt=\"\" style=\"width:42px;height:18px;object-fit:contain;transform:rotate(' + rot + 'deg);\">'",
    "html: '<img src=\"/assets/hsp46.png\" alt=\"\" style=\"width:46px;height:20px;object-fit:contain;transform:rotate(' + rot + 'deg);display:block;\">'"
)
if '.rr-live-train' not in u:
    u = u.replace('</style>', '.rr-live-train{background:transparent!important;border:0!important}</style>', 1)
user.write_text(u, encoding='utf-8')
print('user updated')
