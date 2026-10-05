from pathlib import Path
import re

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t2 = re.sub(r'async\s+function rrShowStopShare', 'function rrShowStopShare', t, count=1)
    t2 = t2.replace('function rrSpecialStopSharing(opts)', 'async function rrSpecialStopSharing(opts)', 1)
    if t2 == t:
        print('no change', path)
        return
    p.write_text(t2, encoding='utf-8')
    print('fixed', path)

patch('index.html')
patch('mytrips/index.html')
