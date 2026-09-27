from pathlib import Path

ZOOM = '''  <style id="rr-popup-zoom">
    .leaflet-popup-content-wrapper {
      transform: none !important;
      overflow: visible !important;
    }
    .leaflet-popup-content {
      width: auto !important;
      max-width: min(420px, calc(100vw - 20px)) !important;
      overflow: visible !important;
    }
    .train-popup,
    .station-popup {
      width: max-content !important;
      max-width: min(420px, calc(100vw - 20px)) !important;
      overflow: visible !important;
      font-size: 12px !important;
    }
    .train-popup-header,
    .train-popup-body,
    .train-popup-footer {
      padding: 8px 10px !important;
    }
    .train-popup-header h3 {
      font-size: 14px !important;
    }
    .stops-list li,
    .departures-list li {
      font-size: 11px !important;
      padding: 4px 6px !important;
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
        'return { maxWidth: 640, minWidth: 320, closeOnClick: true, autoClose: true, closeButton: true };',
        'return { maxWidth: 420, minWidth: 260, closeOnClick: true, autoClose: true, closeButton: true };',
        1,
    )
    t = t.replace(
        'if (w <= 700) return { maxWidth: Math.max(280, w - 16), minWidth: 240, closeOnClick: true, autoClose: true, closeButton: true };',
        'if (w <= 700) return { maxWidth: Math.max(260, w - 20), minWidth: 220, closeOnClick: true, autoClose: true, closeButton: true };',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
