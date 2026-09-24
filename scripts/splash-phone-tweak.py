from pathlib import Path
OLD = '''    @media (min-width: 860px) {
      .mytrips-guest-phone { width: min(520px, 42vw); }
    }
    @media (min-width: 1200px) {
      .mytrips-guest-phone { width: min(620px, 46vw); }
    }'''
NEW = '''    @media (min-width: 860px) {
      .mytrips-guest-phone-wrap { justify-content: flex-end; padding-right: 2vw; }
      .mytrips-guest-phone { width: min(380px, 34vw); }
    }
    @media (min-width: 1200px) {
      .mytrips-guest-phone-wrap { padding-right: 4vw; }
      .mytrips-guest-phone { width: min(420px, 32vw); }
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        p.write_text(t, encoding='utf-8')
        print('patched', path)
    else:
        raise SystemExit('desktop phone css missing in ' + path)

patch('index.html')
patch('mytrips/index.html')
