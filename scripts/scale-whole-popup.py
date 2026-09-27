from pathlib import Path

STYLE = '''  <style id="rr-popup-zoom">
    .leaflet-popup {
      zoom: 0.82;
    }
    @media (max-width: 700px) {
      .leaflet-popup {
        zoom: 0.78;
      }
    }
  </style>
'''

def strip_style(t, sid):
    marker = '<style id="%s">' % sid
    start = t.find(marker)
    if start < 0:
        return t
    end = t.find('</style>', start)
    if end < 0:
        return t
    end += len('</style>')
    if end < len(t) and t[end] == '\n':
        end += 1
    return t[:start] + t[end:]

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = strip_style(t, 'rr-popup-content-scale')
    t = strip_style(t, 'rr-popup-zoom')
    t = t.replace('</head>', STYLE + '</head>', 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
