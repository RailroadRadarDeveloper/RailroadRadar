from pathlib import Path

ZOOM = '''  <style id="rr-popup-zoom">
    .leaflet-popup-content-wrapper,
    .leaflet-popup-content,
    .train-popup,
    .station-popup {
      width: 280px !important;
      min-width: 0 !important;
      max-width: 280px !important;
      box-sizing: border-box !important;
      transform: none !important;
    }
    .train-popup,
    .station-popup,
    .leaflet-popup-content {
      font-size: 11px !important;
      line-height: 1.25 !important;
    }
    .train-popup-header,
    .train-popup-body,
    .train-popup-footer,
    .station-popup {
      padding: 6px 8px !important;
    }
    .train-popup-header h2,
    .train-popup-header h3,
    .station-popup h3 {
      font-size: 13px !important;
      line-height: 1.2 !important;
      margin: 0 0 2px !important;
    }
    .train-popup-header img,
    .station-popup img {
      width: 22px !important;
      height: 22px !important;
    }
    .info-grid { gap: 4px 6px !important; margin-bottom: 6px !important; }
    .info-item, .info-label, .info-value, .quick-status { font-size: 10px !important; }
    .upcoming-stops h4 { font-size: 11px !important; margin: 4px 0 6px !important; }
    .stops-list, .departures-list { max-height: 150px !important; }
    .stops-list li, .departures-list li {
      padding: 3px 4px !important;
      font-size: 10px !important;
      gap: 4px !important;
    }
    .stop-time, .stop-name, .stop-status, .departure-time, .track-badge {
      font-size: 10px !important;
    }
    .stop-mileage { font-size: 9px !important; }
    .checkmark { width: 10px !important; height: 10px !important; }
    .track-badge { padding: 1px 4px !important; }
    .train-popup button, .station-popup button, .popup-action-btn,
    .train-popup .rr-btn, .train-popup a.button {
      font-size: 10px !important;
      padding: 5px 6px !important;
      line-height: 1.2 !important;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content-wrapper,
      .leaflet-popup-content,
      .train-popup,
      .station-popup {
        width: min(280px, calc(100vw - 24px)) !important;
        max-width: min(280px, calc(100vw - 24px)) !important;
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
        t = t[:start] + ZOOM.strip() + t[end:]
        print('replaced', path)
    else:
        t = t.replace('</head>', ZOOM + '</head>', 1)
        print('inserted', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
