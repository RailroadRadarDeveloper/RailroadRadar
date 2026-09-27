from pathlib import Path

STYLE = '''  <style id="rr-smaller-popups">
    .leaflet-popup-content-wrapper,
    .leaflet-popup-content {
      max-width: 320px !important;
      width: 320px !important;
      max-height: 280px !important;
    }
    .train-popup,
    .station-popup {
      min-width: 240px !important;
      max-width: 320px !important;
      width: 320px !important;
      font-size: 13px !important;
    }
    .train-popup-header,
    .train-popup-body,
    .train-popup-footer {
      padding: 8px 10px !important;
    }
    .station-popup {
      padding: 10px 12px !important;
    }
    .stops-list,
    .departures-list {
      max-height: 160px !important;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content-wrapper,
      .leaflet-popup-content,
      .train-popup,
      .station-popup {
        max-width: min(300px, calc(100vw - 24px)) !important;
        width: min(300px, calc(100vw - 24px)) !important;
        min-width: 0 !important;
        max-height: 240px !important;
      }
      .stops-list,
      .departures-list {
        max-height: 140px !important;
      }
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'id="rr-smaller-popups"' in t:
        start = t.find('<style id="rr-smaller-popups">')
        end = t.find('</style>', start) + len('</style>')
        t = t[:start] + STYLE.strip() + t[end:]
        print('replaced', path)
    else:
        t = t.replace('</head>', STYLE + '</head>', 1)
        print('inserted', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
