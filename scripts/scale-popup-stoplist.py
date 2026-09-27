from pathlib import Path

OLD = '''  <style id="rr-popup-zoom">
    .leaflet-popup {
      zoom: 0.82;
    }
    @media (max-width: 700px) {
      .leaflet-popup {
        zoom: 0.78;
      }
    }
  </style>'''

OLD2 = '''  <style id="rr-popup-zoom">
    .leaflet-popup {
      zoom: 0.72;
    }
    @media (max-width: 700px) {
      .leaflet-popup {
        zoom: 0.68;
      }
    }
  </style>'''

NEW = '''  <style id="rr-popup-zoom">
    .leaflet-popup {
      zoom: 0.72;
    }
    .leaflet-popup .upcoming-stops,
    .leaflet-popup .stops-list,
    .leaflet-popup .departures-list {
      zoom: 0.88;
      font-size: 11px !important;
    }
    .leaflet-popup .stops-list,
    .leaflet-popup .departures-list {
      max-height: 170px !important;
    }
    .leaflet-popup .stops-list li,
    .leaflet-popup .departures-list li {
      padding: 4px 6px !important;
      font-size: 11px !important;
      line-height: 1.25 !important;
    }
    .leaflet-popup .stop-time,
    .leaflet-popup .stop-name,
    .leaflet-popup .stop-status,
    .leaflet-popup .departure-time {
      font-size: 11px !important;
    }
    .leaflet-popup .checkmark {
      width: 11px !important;
      height: 11px !important;
    }
    .leaflet-popup .upcoming-stops h4 {
      font-size: 11px !important;
      margin: 4px 0 6px !important;
    }
    @media (max-width: 700px) {
      .leaflet-popup {
        zoom: 0.68;
      }
      .leaflet-popup .stops-list,
      .leaflet-popup .departures-list {
        max-height: 150px !important;
      }
    }
  </style>'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        print('replaced 0.82 block', path)
    elif OLD2 in t:
        t = t.replace(OLD2, NEW, 1)
        print('replaced 0.72 block', path)
    elif 'id="rr-popup-zoom"' in t:
        start = t.find('<style id="rr-popup-zoom">')
        end = t.find('</style>', start) + len('</style>')
        t = t[:start] + NEW.strip() + t[end:]
        print('replaced by id', path)
    else:
        t = t.replace('</head>', NEW + '</head>', 1)
        print('inserted', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
