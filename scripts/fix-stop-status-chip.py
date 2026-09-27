from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace("disp = pred ? ('Now ' + pred) : 'Delayed';", "disp = pred ? pred : 'Delayed';")
    old = '''    .stop-status {
      font-weight: 700;
      font-size: 11px;
      padding: 1px 7px;
      border-radius: 0;
      white-space: nowrap;
      align-self: flex-start;
      margin-top: 2px;
    }'''
    new = '''    .stop-status {
      font-weight: 700;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 0;
      white-space: nowrap;
      align-self: flex-start;
      margin-top: 2px;
      flex-shrink: 0;
      min-width: max-content;
    }'''
    if old in t:
        t = t.replace(old, new, 1)
        print('css', path)
    extra = '''  <style id="rr-stop-status-fix">
    .leaflet-popup .stop-status {
      flex-shrink: 0 !important;
      white-space: nowrap !important;
      min-width: max-content !important;
      overflow: visible !important;
    }
    .leaflet-popup .stops-list li {
      overflow: visible;
    }
  </style>
'''
    if 'id="rr-stop-status-fix"' not in t:
        t = t.replace('</head>', extra + '</head>', 1)
    p.write_text(t, encoding='utf-8')
    print('Now prefix left', t.count("'Now ' + pred"), path)

patch('index.html')
patch('mytrips/index.html')
