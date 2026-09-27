from pathlib import Path

ZOOM = '''  <style id="rr-popup-zoom">
    .leaflet-popup-content-wrapper {
      transform: scale(0.78);
      transform-origin: bottom center;
      margin-bottom: -6px;
    }
    .leaflet-popup-tip-container {
      margin-top: -8px;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content-wrapper {
        transform: scale(0.74);
        transform-origin: bottom center;
      }
    }
  </style>
'''

JS = '''
      try {
        map.options.closePopupOnClick = true;
        map.on('click', function() {
          try { map.closePopup(); } catch (_) {}
        });
        document.addEventListener('click', function(e) {
          const pop = e.target && e.target.closest && e.target.closest('.leaflet-popup');
          const onMap = e.target && e.target.closest && e.target.closest('#map');
          if (onMap && !pop) {
            try { map.closePopup(); } catch (_) {}
          }
        }, true);
      } catch (_) {}
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
        'function rrPopupOpts() {\n        let w = 520;',
        'function rrPopupOpts() {\n        let w = 520;',
        1,
    )
    t = t.replace(
        'if (w <= 700) return { maxWidth: Math.max(200, w - 28), minWidth: 180 };\n        return { maxWidth: 520, minWidth: 280 };',
        'if (w <= 700) return { maxWidth: Math.max(200, w - 28), minWidth: 180, closeOnClick: true, autoClose: true, closeButton: true };\n        return { maxWidth: 520, minWidth: 280, closeOnClick: true, autoClose: true, closeButton: true };',
        1,
    )
    needle = "const map = L.map('map').setView([43.0, -71.5], 7);"
    if needle in t and 'closePopupOnClick = true' not in t:
        t = t.replace(needle, needle + JS, 1)
        print('wired close', path)
    p.write_text(t, encoding='utf-8')
    print('done', path)

patch('index.html')
patch('mytrips/index.html')
