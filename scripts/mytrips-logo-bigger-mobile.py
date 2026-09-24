from pathlib import Path

OLD = '''    html.rr-mytrips-page img.header-logo {
      height: 42px;
      width: auto;
      max-width: min(210px, 48vw);
      object-fit: contain;
      margin-right: 0;
    }'''
NEW = '''    html.rr-mytrips-page img.header-logo {
      height: 52px;
      width: auto;
      max-width: min(260px, 58vw);
      object-fit: contain;
      margin-right: 0;
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        p.write_text(t, encoding='utf-8')
        print('patched', path)
    elif 'max-width: min(260px, 58vw)' in t:
        print('already bigger', path)
    else:
        raise SystemExit('mobile logo css not found in ' + path)

patch('index.html')
patch('mytrips/index.html')
