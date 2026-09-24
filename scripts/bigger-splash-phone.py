from pathlib import Path
OLD = '    .mytrips-guest-phone { width: min(280px, 72vw); height: auto; display: block; filter: drop-shadow(0 18px 40px rgba(0,0,0,.35)); }'
NEW = '''    .mytrips-guest-phone { width: min(280px, 72vw); height: auto; display: block; filter: drop-shadow(0 18px 40px rgba(0,0,0,.35)); }
    @media (min-width: 860px) {
      .mytrips-guest-phone { width: min(520px, 42vw); }
    }
    @media (min-width: 1200px) {
      .mytrips-guest-phone { width: min(620px, 46vw); }
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        p.write_text(t, encoding='utf-8')
        print('patched', path)
    elif 'min(520px, 42vw)' in t:
        print('already', path)
    else:
        raise SystemExit('phone css missing in ' + path)

patch('index.html')
patch('mytrips/index.html')
