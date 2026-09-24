from pathlib import Path

OLD = '''        <picture class="mytrips-guest-logo-wrap">
          <source media="(min-width: 768px)" srcset="/assets/brand/mytrips-logo-wide.png">
          <img class="mytrips-guest-logo" src="/assets/brand/mytrips-logo.png" alt="MyTrips by RailroadRadar">
        </picture>'''

NEW = '''        <img class="mytrips-guest-logo" src="/assets/brand/mytrips-splash-logo.png" alt="MyTrips by RailroadRadar">'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
    elif 'mytrips-splash-logo.png' not in t:
        t = t.replace('/assets/brand/mytrips-logo-wide.png', '/assets/brand/mytrips-splash-logo.png')
        t = t.replace('src="/assets/brand/mytrips-logo.png" alt="MyTrips by RailroadRadar"', 'src="/assets/brand/mytrips-splash-logo.png" alt="MyTrips by RailroadRadar"')
    t = t.replace('filter: brightness(0) invert(1);', '')
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'splash-logo' in t)

patch('index.html')
patch('mytrips/index.html')
