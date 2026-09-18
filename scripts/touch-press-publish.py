from pathlib import Path
from datetime import datetime, timezone
p=Path('press/index.html')
t=p.read_text(encoding='utf-8')
mark='<!-- press-build '+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')+' -->'
if '<!-- press-build ' in t:
    import re
    t=re.sub(r'<!-- press-build \d+ -->', mark, t, count=1)
else:
    t=t.replace('<title>Press Releases', mark+'\n<title>Press Releases', 1)
# ensure button exists
old='id="ed">Edit</button> <button class="btn danger" id="del">Delete</button>'
new='id="ed">Edit</button> <button class="btn sec" id="dc">Send to Discord</button> <button class="btn danger" id="del">Delete</button>'
if old in t and new not in t:
    t=t.replace(old,new,1)
p.write_text(t,encoding='utf-8')
print('touched', mark)
