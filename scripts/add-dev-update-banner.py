from pathlib import Path

BANNER_HTML = '''  <div class="rr-dev-banner" role="region" aria-label="Development update">
    <a href="https://railroadradar.com/press/index.html?id=development-update-week-of-september-14-2026">View the latest development update</a>
  </div>

'''

BANNER_CSS = '''    .rr-dev-banner {
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      height: 36px;
      z-index: 9998;
      background: #0c1448;
      border-bottom: 1px solid #1a3a5f;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      box-sizing: border-box;
      font-size: 13px;
      font-weight: 700;
    }
    .rr-dev-banner a {
      color: #fff;
      text-decoration: none;
    }
    .rr-dev-banner a:hover {
      text-decoration: underline;
    }
    @media (max-width: 700px) {
      .rr-dev-banner { font-size: 12px; }
    }
'''

p = Path('index.html')
t = p.read_text(encoding='utf-8')

if 'class="rr-dev-banner"' not in t:
    needle = '  <div id="offline-banner" class="offline-banner">'
    if needle not in t:
        raise SystemExit('offline banner not found')
    t = t.replace(needle, BANNER_HTML + needle, 1)

if '.rr-dev-banner {' not in t:
    map_rule = '    #map {\n      position: fixed;\n      top: 60px;'
    if map_rule not in t:
        raise SystemExit('map rule not found')
    t = t.replace(map_rule, BANNER_CSS + '    #map {\n      position: fixed;\n      top: 96px;', 1)
elif '    #map {\n      position: fixed;\n      top: 60px;' in t:
    t = t.replace('    #map {\n      position: fixed;\n      top: 60px;', '    #map {\n      position: fixed;\n      top: 96px;', 1)

t = t.replace(
    'html.rr-train-page #rr-train-page {\n      display: block;\n      position: relative;\n      z-index: 20;\n      margin-top: 60px;',
    'html.rr-train-page #rr-train-page {\n      display: block;\n      position: relative;\n      z-index: 20;\n      margin-top: 96px;',
    1,
)

p.write_text(t, encoding='utf-8')
print('banner added')
