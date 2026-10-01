from pathlib import Path
import urllib.request

OLD = 'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/eb99a17a56967f442d2a7b996d9172eae314d048/index.html'
MARKER = '<div class="search-type-dropdown" id="search-type-dropdown">'

def header_prefix():
    old = urllib.request.urlopen(OLD, timeout=60).read().decode('utf-8', 'replace')
    start = old.find('<div class="header">')
    end = old.find(MARKER)
    if start < 0 or end < 0:
        raise SystemExit('old header not found')
    return old[start:end]

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if '<div class="header">' not in t and MARKER in t:
        t = t.replace(MARKER, header_prefix() + MARKER, 1)
        print('restored header', path)
    else:
        print('header present', path)
    t = t.replace(
        "html.rr-banned #map, html.rr-banned .header, html.rr-banned #loading-screen { display:none !important; }",
        "html.rr-banned #map, html.rr-banned #loading-screen { display:none !important; } html.rr-banned .header { display:flex !important; z-index:100000 !important; } html.rr-banned .header > :not(.header-logo) { display:none !important; }",
    )
    t = t.replace(
        'id="rr-banned-screen" hidden style="display:none;position:fixed;inset:0;z-index:2147483000;background:#07093e;',
        'id="rr-banned-screen" hidden style="display:none;position:fixed;top:60px;left:0;right:0;bottom:0;z-index:9000;background:#07093e;',
    )
    extra = '''  <style id="rr-banned-logo-only">
    html.rr-banned .header { display:flex !important; z-index:100000 !important; }
    html.rr-banned .header > :not(.header-logo) { display:none !important; }
    html.rr-banned #rr-banned-screen { top:60px !important; z-index:9000 !important; }
  </style>
'''
    if 'id="rr-banned-logo-only"' not in t:
        t = t.replace('</head>', extra + '</head>', 1)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
