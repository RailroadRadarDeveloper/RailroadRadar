from pathlib import Path

OLD = '''    .trip-detail-overlay {
      height: 100%;
      height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: 0;
      box-sizing: border-box;
    }
    .trip-detail-map {
      height: clamp(132px, 28vh, 220px);
      min-height: 132px;
      max-height: 220px;
      flex: 0 0 auto;
    }'''

NEW = '''    .trip-detail-overlay {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      height: 100dvh !important;
      max-height: none !important;
      overflow: hidden;
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: 0;
      box-sizing: border-box;
    }
    .trip-detail-overlay.open {
      display: flex !important;
    }
    .trip-detail-map {
      height: 42vh !important;
      min-height: 220px;
      max-height: none !important;
      flex: 1 1 42%;
    }
    html.rr-mytrips-page.rr-trip-detail-open,
    html.rr-mytrips-page.rr-trip-detail-open body {
      height: 100% !important;
      overflow: hidden !important;
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        p.write_text(t, encoding='utf-8')
        print('patched', path)
    elif 'flex: 1 1 42%' in t:
        print('already patched', path)
    else:
        raise SystemExit('overlay block not found in ' + path)

patch('index.html')
patch('mytrips/index.html')
