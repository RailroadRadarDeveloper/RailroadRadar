#!/usr/bin/env python3
from pathlib import Path

NEEDLE = '    <div class="header-center">Admin Dashboard</div>\n'
CSS1 = '    .header-center { font-weight: 800; letter-spacing: .04em; text-transform: uppercase; font-size: 14px; }\n'
CSS2 = '      .header-center { display: none; }\n'

for rel in ('admin.html', 'scripts/build-admin-page.py'):
    p = Path(rel)
    text = p.read_text(encoding='utf-8')
    if NEEDLE in text:
        text = text.replace(NEEDLE, '', 1)
    text = text.replace(CSS1, '', 1)
    text = text.replace(CSS2, '', 1)
    p.write_text(text, encoding='utf-8')
    print('updated', rel, 'header-center left', text.count('header-center'))
