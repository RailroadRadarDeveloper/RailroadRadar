from pathlib import Path

STYLE = '''  <style id="rr-popup-fit">
    .leaflet-popup {
      max-width: min(320px, calc(100vw - 24px)) !important;
    }
    .leaflet-popup-content-wrapper {
      max-width: min(320px, calc(100vw - 24px)) !important;
      width: min(320px, calc(100vw - 24px)) !important;
      box-sizing: border-box !important;
      padding: 0 !important;
    }
    .leaflet-popup-content {
      max-width: 100% !important;
      width: 100% !important;
      max-height: 280px !important;
      margin: 0 !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
    }
    .train-popup,
    .station-popup {
      min-width: 0 !important;
      max-width: 100% !important;
      width: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      font-size: 13px !important;
    }
    .train-popup *,
    .station-popup * {
      box-sizing: border-box;
      max-width: 100%;
    }
    .train-popup img,
    .station-popup img {
      max-width: 100%;
      height: auto;
    }
    .train-popup-header,
    .train-popup-body,
    .train-popup-footer {
      padding: 8px 10px !important;
      width: 100%;
    }
    .train-popup-header {
      overflow: hidden;
    }
    .train-popup-header h3,
    .train-popup-header h2,
    .station-popup h3,
    .station-popup h4,
    .upcoming-stops h4 {
      font-size: 14px !important;
      line-height: 1.25 !important;
      margin: 0 0 4px !important;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .info-grid {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
      gap: 6px 8px !important;
      margin-bottom: 8px !important;
      width: 100%;
    }
    .info-item {
      min-width: 0 !important;
      padding-bottom: 4px !important;
    }
    .popup-action-btn,
    .log-trip-btn,
    .train-popup button,
    .station-popup button {
      max-width: 100%;
      white-space: normal;
      font-size: 12px !important;
    }
    .stops-list,
    .departures-list {
      width: 100% !important;
      max-height: 150px !important;
    }
    .stops-list li {
      min-width: 0;
    }
    .stop-name,
    .stop-time,
    .stop-status {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    @media (max-width: 700px) {
      .leaflet-popup,
      .leaflet-popup-content-wrapper {
        max-width: min(300px, calc(100vw - 20px)) !important;
        width: min(300px, calc(100vw - 20px)) !important;
      }
      .leaflet-popup-content {
        max-height: 240px !important;
      }
      .stops-list,
      .departures-list {
        max-height: 130px !important;
      }
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    for sid in ('rr-popup-fit', 'rr-smaller-popups'):
        marker = '<style id="%s">' % sid
        if marker in t:
            start = t.find(marker)
            end = t.find('</style>', start) + len('</style>')
            t = t[:start] + t[end:]
    t = t.replace('</head>', STYLE + '</head>', 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
