from pathlib import Path

ZOOM = '''  <style id="rr-popup-zoom">
    .leaflet-popup-content-wrapper {
      transform: scale(0.88);
      transform-origin: bottom center;
      margin-bottom: -6px;
      overflow: visible !important;
    }
    .leaflet-popup-content {
      max-width: 680px !important;
      overflow: visible !important;
    }
    .train-popup,
    .station-popup {
      min-width: 360px !important;
      max-width: 680px !important;
      overflow: visible !important;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content-wrapper {
        transform: scale(0.86);
        transform-origin: bottom center;
      }
      .leaflet-popup-content,
      .train-popup,
      .station-popup {
        min-width: calc(100vw - 20px) !important;
        max-width: calc(100vw - 20px) !important;
        width: calc(100vw - 20px) !important;
      }
    }
  </style>
'''

STATUS = '''  <style id="rr-stop-status-fix">
    .stops-list li {
      display: grid !important;
      grid-template-columns: 72px minmax(0, 1fr) max-content;
      column-gap: 8px;
      align-items: start;
      overflow: visible !important;
    }
    .stops-list li .stop-name {
      min-width: 0;
      overflow: visible !important;
    }
    .stops-list li .stop-status {
      white-space: nowrap !important;
      overflow: visible !important;
      min-width: max-content !important;
      justify-self: end;
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
    t = replace_style(t, 'rr-stop-status-fix', STATUS)
    t = t.replace(
        '.train-popup {\n      font-size: 14px;\n      min-width: 320px;\n      max-width: 580px;\n      width: max-content;\n      overflow: hidden;',
        '.train-popup {\n      font-size: 14px;\n      min-width: 360px;\n      max-width: 680px;\n      width: max-content;\n      overflow: visible;',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
