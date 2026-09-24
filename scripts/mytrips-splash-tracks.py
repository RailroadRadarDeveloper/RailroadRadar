from pathlib import Path

OLD = '''    html.rr-mytrips-page.rr-mytrips-guest,
    html.rr-mytrips-page.rr-mytrips-guest body {
      background: #07093e !important;
    }'''

NEW = '''    html.rr-mytrips-page.rr-mytrips-guest,
    html.rr-mytrips-page.rr-mytrips-guest body {
      background-color: #07093e !important;
      background-image:
        url('/assets/brand/tracks-right-top.png'),
        url('/assets/brand/tracks-left-bottom.png');
      background-position: top -40px right -60px, bottom left -80px;
      background-repeat: no-repeat, no-repeat;
      background-size: min(480px, 60vw), min(520px, 70vw);
    }
    html.rr-mytrips-page .mytrips-guest {
      background-color: transparent;
      background-image:
        url('/assets/brand/tracks-right-top.png'),
        url('/assets/brand/tracks-left-bottom.png');
      background-position: top -40px right -60px, bottom left -80px;
      background-repeat: no-repeat, no-repeat;
      background-size: min(480px, 60vw), min(520px, 70vw);
    }'''

# the guest box currently sets solid navy; make sure we don't fight it
OLD2 = '''    html.rr-mytrips-page .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 18px 48px;
      background: #07093e;
      color: #fff;
    }'''
NEW2 = '''    html.rr-mytrips-page .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 18px 48px;
      background-color: transparent;
      color: #fff;
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
    if OLD2 in t:
        t = t.replace(OLD2, NEW2, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
