from pathlib import Path
import re
index = Path('index.html').read_text(encoding='utf-8', errors='replace')
m = re.search(r'src="(data:image/png;base64,[^"]+)"[^>]*class="header-logo"', index)
if not m:
    raise SystemExit('logo not found')
live = Path('live/index.html')
t = live.read_text(encoding='utf-8')
t = t.replace('src="/assets/logo.png"', 'src="' + m.group(1) + '"', 1)
live.write_text(t, encoding='utf-8')
print('logo set', len(m.group(1)))
