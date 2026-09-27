from pathlib import Path

STYLE = '''  <style id="rr-popup-content-scale">
    .train-popup,
    .station-popup {
      font-size: 12px;
    }
    .train-popup-header {
      padding: 10px 12px !important;
    }
    .train-popup-header h3,
    .station-popup h3 {
      font-size: 15px !important;
      line-height: 1.2 !important;
    }
    .train-popup-body,
    .train-popup-footer {
      padding: 10px 12px !important;
    }
    .station-popup {
      padding: 10px 12px !important;
    }
    .info-grid {
      gap: 6px 10px !important;
      margin-bottom: 8px !important;
    }
    .info-item {
      padding-bottom: 4px !important;
    }
    .info-item .label,
    .info-label {
      font-size: 10px !important;
    }
    .info-item .value,
    .info-value {
      font-size: 12px !important;
    }
    .quick-status {
      margin-bottom: 8px !important;
      padding-bottom: 6px !important;
      font-size: 12px !important;
    }
    .upcoming-stops h4 {
      font-size: 12px !important;
      margin: 6px 0 !important;
    }
    .stops-list li,
    .departures-list li {
      padding: 5px 8px !important;
      font-size: 11px !important;
      gap: 6px !important;
    }
    .stop-time,
    .departure-time {
      font-size: 11px !important;
      min-width: 42px !important;
    }
    .stop-name {
      font-size: 11px !important;
    }
    .stop-status {
      font-size: 10px !important;
    }
    .checkmark {
      width: 12px !important;
      height: 12px !important;
    }
    .train-popup button,
    .station-popup button,
    .popup-action-btn {
      font-size: 11px !important;
      padding: 6px 8px !important;
    }
    .stop-mileage {
      font-size: 9px !important;
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    marker = '<style id="rr-popup-content-scale">'
    if marker in t:
        start = t.find(marker)
        end = t.find('</style>', start) + len('</style>')
        t = t[:start] + STYLE.strip() + t[end:]
        print('replaced', path)
    else:
        t = t.replace('</head>', STYLE + '</head>', 1)
        print('inserted', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
