from pathlib import Path

ZOOM = '''  <style id="rr-popup-zoom">
    .leaflet-popup-content-wrapper,
    .leaflet-popup-content,
    .train-popup,
    .station-popup {
      width: min(340px, calc(100vw - 20px)) !important;
      min-width: 0 !important;
      max-width: min(340px, calc(100vw - 20px)) !important;
      box-sizing: border-box !important;
      transform: none !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
    }
    .train-popup-header,
    .train-popup-body,
    .train-popup-footer {
      padding: 8px 10px !important;
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
        '.train-popup {\n      font-size: 14px;\n      min-width: 360px;\n      max-width: 680px;\n      width: max-content;\n      overflow: visible;',
        '.train-popup {\n      font-size: 13px;\n      min-width: 0;\n      max-width: 340px;\n      width: 340px;\n      overflow: visible;',
        1,
    )
    t = t.replace(
        'return { maxWidth: 420, minWidth: 260, closeOnClick: true, autoClose: true, closeButton: true };',
        'return { maxWidth: 340, minWidth: 220, closeOnClick: true, autoClose: true, closeButton: true };',
        1,
    )
    t = t.replace(
        'if (w <= 700) return { maxWidth: Math.max(260, w - 20), minWidth: 220, closeOnClick: true, autoClose: true, closeButton: true };',
        'if (w <= 700) return { maxWidth: Math.min(340, Math.max(220, w - 20)), minWidth: 200, closeOnClick: true, autoClose: true, closeButton: true };',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
