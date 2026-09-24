from pathlib import Path

OLD = '''        const center = document.querySelector('.header-center');
        if (center && !document.getElementById('rr-mytrips-page-title')) {
          const title = document.createElement('div');
          title.id = 'rr-mytrips-page-title';
          title.className = 'rr-mytrips-page-title';
          title.textContent = 'MyTrips';
          center.insertBefore(title, center.firstChild);
        }'''
NEW = '''        const oldTitle = document.getElementById('rr-mytrips-page-title');
        if (oldTitle && oldTitle.parentNode) oldTitle.parentNode.removeChild(oldTitle);'''

CSS_OLD = '''    .rr-mytrips-page-title {
      color: #fff;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }'''
CSS_NEW = '''    .rr-mytrips-page-title {
      display: none !important;
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
    else:
        print('title inject not exact in', path)
    if CSS_OLD in t:
        t = t.replace(CSS_OLD, CSS_NEW, 1)
    t = t.replace("logo.setAttribute('title', 'RailroadRadar home');", "logo.setAttribute('title', 'Home');", 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
