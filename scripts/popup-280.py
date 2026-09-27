from pathlib import Path

ZOOM = '''  <style id="rr-popup-zoom">
    .leaflet-popup-content-wrapper,
    .leaflet-popup-content,
    .train-popup,
    .station-popup {
      width: 280px !important;
      min-width: 280px !important;
      max-width: 280px !important;
      box-sizing: border-box !important;
      transform: none !important;
    }
    .leaflet-popup-content { margin: 0 !important; }
    .train-popup-header, .train-popup-body, .train-popup-footer { padding: 8px 10px !important; }
    .stops-list, .departures-list { max-height: 160px !important; }
    @media (max-width: 700px) {
      .leaflet-popup-content-wrapper,
      .leaflet-popup-content,
      .train-popup,
      .station-popup {
        width: min(280px, calc(100vw - 24px)) !important;
        min-width: 0 !important;
        max-width: min(280px, calc(100vw - 24px)) !important;
      }
    }
  </style>
'''

JS = '''
      map.on('popupopen', function(ev) {
        try {
          const box = ev && ev.popup && ev.popup._container;
          if (!box) return;
          const w = (window.innerWidth && window.innerWidth < 320) ? (window.innerWidth - 24) : 280;
          box.style.width = w + 'px';
          box.style.maxWidth = w + 'px';
          const nodes = box.querySelectorAll('.leaflet-popup-content-wrapper, .leaflet-popup-content, .train-popup, .station-popup');
          for (let i = 0; i < nodes.length; i++) {
            nodes[i].style.width = w + 'px';
            nodes[i].style.maxWidth = w + 'px';
            nodes[i].style.minWidth = '0px';
          }
        } catch (_) {}
      });
'''

def replace_style(t, sid, block):
    marker = '<style id="%s">' % sid
    if marker in t:
        start = t.find(marker)
        end = t.find('</style>', start) + len('</style>')
        return t[:start] + block.strip() + t[end:]
    return t.replace('</head>', block + '</head>', 1)

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = replace_style(t, 'rr-popup-zoom', ZOOM)
    t = t.replace('return { maxWidth: 340, minWidth: 220,', 'return { maxWidth: 280, minWidth: 200,')
    t = t.replace(
        'if (w <= 700) return { maxWidth: Math.min(340, Math.max(220, w - 20)), minWidth: 200,',
        'if (w <= 700) return { maxWidth: Math.min(280, Math.max(200, w - 24)), minWidth: 180,',
    )
    t = t.replace(
        '.train-popup {\n      font-size: 13px;\n      min-width: 0;\n      max-width: 340px;\n      width: 340px;',
        '.train-popup {\n      font-size: 13px;\n      min-width: 0;\n      max-width: 280px;\n      width: 280px;',
        1,
    )
    if "map.on('popupopen', function(ev)" not in t:
        needle = "const map = L.map('map').setView([43.0, -71.5], 7);"
        if needle in t:
            t = t.replace(needle, needle + JS, 1)
            print('js hook', path)
    p.write_text(t, encoding='utf-8')
    print('done', path)

patch('index.html')
patch('mytrips/index.html')
