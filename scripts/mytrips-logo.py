from pathlib import Path

OLD = '''      if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) {
        document.documentElement.classList.add('rr-mytrips-page');
        document.title = 'MyTrips \u2014 RailroadRadar';
      }'''
NEW = '''      if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) {
        document.documentElement.classList.add('rr-mytrips-page');
        document.title = 'MyTrips \u2014 RailroadRadar';
        document.addEventListener('DOMContentLoaded', function() {
          var img = document.querySelector('img.header-logo');
          if (!img) return;
          img.src = '/assets/brand/mytrips-logo.png';
          img.alt = 'MyTrips by RailroadRadar';
          img.onerror = function() {
            img.onerror = null;
            img.src = 'https://i.postimg.cc/8PzqYZ2S/My-Trips-by-Railroad-Radar.png';
          };
        });
      }'''
CSS = '''    html.rr-mytrips-page img.header-logo {
      height: 48px;
      width: auto;
      max-width: min(320px, 46vw);
      object-fit: contain;
    }\n'''

def patch(path):
    p = Path(path)
    if not p.exists():
        print('skip missing', path)
        return
    t = p.read_text(encoding='utf-8')
    if '/assets/brand/mytrips-logo.png' not in t:
        if OLD not in t:
            raise SystemExit('mytrips init block not found in ' + path)
        t = t.replace(OLD, NEW, 1)
    if 'html.rr-mytrips-page img.header-logo' not in t:
        needle = '    .header-logo {\n      height: 40px;\n      margin-right: 10px;\n    }'
        if needle in t:
            t = t.replace(needle, needle + '\n' + CSS, 1)
        else:
            t = t.replace('.header-logo {', CSS + '    .header-logo {', 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
