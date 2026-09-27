from pathlib import Path

NEW = '''  <style id="rr-popup-zoom">
    .leaflet-popup {
      zoom: 0.72;
    }
    @media (max-width: 700px) {
      .leaflet-popup {
        zoom: 0.68;
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
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
