from pathlib import Path

OLD_CSS = '''    #trip-detail-overlay.trip-detail-capturing .trip-detail-share-logo {
      display: none !important;
    }'''

NEW_CSS = '''    #trip-detail-overlay.trip-detail-capturing {
      position: fixed !important;
      inset: auto !important;
      top: 0 !important;
      left: 0 !important;
      width: 360px !important;
      height: 640px !important;
      max-width: 360px !important;
      max-height: 640px !important;
      display: flex !important;
      flex-direction: column !important;
      background: #0b0d1a !important;
      overflow: hidden !important;
      transform: none !important;
      opacity: 1 !important;
    }
    #trip-detail-overlay.trip-detail-capturing .trip-detail-map {
      flex: 0 0 56% !important;
      height: 56% !important;
      min-height: 0 !important;
      max-height: none !important;
    }
    #trip-detail-overlay.trip-detail-capturing .trip-detail-panel {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }
    #trip-detail-overlay.trip-detail-capturing #trip-detail-save-bar {
      display: none !important;
    }
    #trip-detail-overlay.trip-detail-capturing .trip-detail-share-logo {
      display: none !important;
    }'''

OLD_DRAW = '''      if (srcAspect > destAspect) {
        dw = targetW;
        dh = targetW / srcAspect;
        dx = 0;
        dy = (targetH - dh) / 2;
      } else {
        dh = targetH;
        dw = targetH * srcAspect;
        dy = 0;
        dx = (targetW - dw) / 2;
      }
      ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, dw, dh);'''

NEW_DRAW = '''      ctx.drawImage(img, 0, 0, srcW, srcH, 0, 0, targetW, targetH);'''

OLD_WAIT = '''      try { if (tripDetailMap) tripDetailMap.invalidateSize(false); } catch (_) {}
      await new Promise(function(r) { setTimeout(r, 80); });'''
NEW_WAIT = '''      try { if (tripDetailMap) tripDetailMap.invalidateSize(false); } catch (_) {}
      await new Promise(function(r) { setTimeout(r, 220); });
      try { if (tripDetailMap) tripDetailMap.invalidateSize(false); } catch (_) {}'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_CSS in t:
        t = t.replace(OLD_CSS, NEW_CSS, 1)
    if OLD_DRAW in t:
        t = t.replace(OLD_DRAW, NEW_DRAW, 1)
    if OLD_WAIT in t:
        t = t.replace(OLD_WAIT, NEW_WAIT, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
