#!/usr/bin/env python3
from pathlib import Path
path = Path("index.html")
text = path.read_text(encoding="utf-8")
old = """      // iOS/Android often show Mapbox/Carto \"API key needed\" tiles (HTTP 200, so\n      // tileerror never fires). Start those devices on key-free Esri tiles.\n      const preferKeylessTiles = (function() {\n        try {\n          const ua = (navigator.userAgent || '') + ' ' + (navigator.platform || '');\n          const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);\n          const small = Math.min(screen.width || 0, screen.height || 0) > 0 && Math.min(screen.width, screen.height) <= 900;\n          const mobileUA = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);\n          return !!(touch && (small || mobileUA));\n        } catch (_) { return false; }\n      })();"""
new = """      // Mobile uses the same Mapbox Light default as desktop.\n      const preferKeylessTiles = false;"""
if old not in text:
    # try without extra escaping issues by unique snippet
    needle = "const preferKeylessTiles = (function() {"
    if needle not in text:
        raise SystemExit('preferKeylessTiles not found')
    start = text.find(needle)
    end = text.find("})();", start)
    if end < 0:
        raise SystemExit('preferKeylessTiles end not found')
    end = end + len("})();")
    # include preceding comment if present
    comment = text.rfind("// iOS/Android", 0, start)
    if comment >= 0:
        start = comment
    text = text[:start] + "// Mobile uses the same Mapbox Light default as desktop.\n      const preferKeylessTiles = false;" + text[end:]
else:
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('patched')
