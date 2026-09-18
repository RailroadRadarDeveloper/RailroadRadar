#!/usr/bin/env python3
from pathlib import Path

NEEDLE = '      <a class="header-auth-btn" href="https://railroadradar.com/">Back to map</a>\n'

for rel in ('admin.html', 'scripts/build-admin-page.py'):
    p = Path(rel)
    text = p.read_text(encoding='utf-8')
    if NEEDLE not in text:
        print('already gone or missing in', rel)
    else:
        text = text.replace(NEEDLE, '', 1)
        p.write_text(text, encoding='utf-8')
        print('removed header Back to map from', rel)
