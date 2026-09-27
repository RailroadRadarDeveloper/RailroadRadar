from pathlib import Path

ZOOM = '''  <style id="rr-popup-zoom">
    .leaflet-popup-content-wrapper {
      transform: none !important;
      overflow: visible !important;
    }
    .leaflet-popup-content {
      width: auto !important;
      max-width: min(640px, calc(100vw - 16px)) !important;
      overflow: visible !important;
    }
    .train-popup,
    .station-popup {
      width: max-content !important;
      max-width: min(640px, calc(100vw - 16px)) !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }
    .train-popup .stops-list,
    .station-popup .departures-list {
      overflow-x: visible !important;
    }
  </style>
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
    t = t.replace(
        'if (w <= 700) return { maxWidth: Math.max(200, w - 28), minWidth: 180, closeOnClick: true, autoClose: true, closeButton: true };\n        return { maxWidth: 520, minWidth: 280, closeOnClick: true, autoClose: true, closeButton: true };',
        'if (w <= 700) return { maxWidth: Math.max(280, w - 16), minWidth: 240, closeOnClick: true, autoClose: true, closeButton: true };\n        return { maxWidth: 640, minWidth: 320, closeOnClick: true, autoClose: true, closeButton: true };',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
