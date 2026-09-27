from pathlib import Path

HTML = '''  <div class="rr-dev-banner" role="region" aria-label="Development update">
    <a href="https://railroadradar.com/press/index.html?id=development-update-week-of-september-14-2026">View the latest development update</a>
  </div>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if HTML in t:
        t = t.replace(HTML, '', 1)
        print('removed html', path)
    t = t.replace('.rr-dev-banner {', '.rr-dev-banner { display: none !important;\n    }\n    .rr-dev-banner-removed {', 1)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
