from pathlib import Path
import re

OLD_MOBILE = '''      .leaflet-popup-content {
        max-width: calc(100vw - 28px) !important;
        width: auto !important;
        max-height: min(48vh, 320px);
      }
      .train-popup,
      .station-popup {
        min-width: min(300px, calc(100vw - 16px)) !important;
        max-width: min(400px, calc(100vw - 16px)) !important;
        width: min(400px, calc(100vw - 16px)) !important;
      }'''

NEW_MOBILE = '''      .leaflet-popup-content {
        max-width: calc(100vw - 28px) !important;
        width: auto !important;
        max-height: min(380px, 62vh);
      }
      .train-popup,
      .station-popup {
        min-width: 0 !important;
        max-width: calc(100vw - 28px) !important;
        width: auto !important;
      }'''

def strip_style(t, sid):
    marker = '<style id="%s">' % sid
    start = t.find(marker)
    if start < 0:
        return t, False
    end = t.find('</style>', start)
    if end < 0:
        return t, False
    end += len('</style>')
    if end < len(t) and t[end] == '\n':
        end += 1
    return t[:start] + t[end:], True

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    for sid in ['rr-stop-list-mobile', 'rr-popup-fit', 'rr-popup-text-sm', 'rr-smaller-popups']:
        t, ok = strip_style(t, sid)
        print(sid, 'removed' if ok else 'absent', path)
    if OLD_MOBILE in t:
        t = t.replace(OLD_MOBILE, NEW_MOBILE, 1)
        print('mobile restored', path)
    t = t.replace('max-height: min(72vh, 580px) !important;', 'max-height: min(380px, 62vh);')
    t = t.replace('max-height: min(48vh, 320px) !important;', 'max-height: min(380px, 62vh);')
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
