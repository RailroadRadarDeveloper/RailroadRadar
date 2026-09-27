from pathlib import Path

NEW = '''  <style id="rr-popup-zoom">
    .leaflet-popup {
      zoom: 1;
    }
    .leaflet-popup-content-wrapper {
      transform: scale(0.78);
      transform-origin: bottom center;
      margin-bottom: -6px;
    }
    .leaflet-popup-tip-container {
      margin-top: -8px;
    }
    .leaflet-popup-content {
      max-width: 580px !important;
    }
    .train-popup,
    .station-popup {
      min-width: 320px !important;
      max-width: 580px !important;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content-wrapper {
        transform: scale(0.74);
        transform-origin: bottom center;
      }
      .train-popup,
      .station-popup {
        min-width: min(300px, calc(100vw - 24px)) !important;
        max-width: min(360px, calc(100vw - 24px)) !important;
      }
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    marker = '<style id="rr-popup-zoom">'
    if marker in t:
        start = t.find(marker)
        end = t.find('</style>', start) + len('</style>')
        t = t[:start] + NEW.strip() + t[end:]
        print('replaced', path)
    else:
        t = t.replace('</head>', NEW + '</head>', 1)
        print('inserted', path)
    t = t.replace(
        '.train-popup {\n      font-size: 14px;\n      min-width: 280px;\n      max-width: 520px;',
        '.train-popup {\n      font-size: 14px;\n      min-width: 320px;\n      max-width: 580px;',
        1,
    )
    t = t.replace(
        'max-width: 520px;\n      width: max-content;\n      overflow-x: hidden;\n      overflow-y: auto;',
        'max-width: 580px;\n      width: max-content;\n      overflow-x: hidden;\n      overflow-y: auto;',
        1,
    )
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
