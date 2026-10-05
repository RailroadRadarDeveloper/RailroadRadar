from pathlib import Path
import re

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t2 = re.sub(r'async\s+function rrShowStopShare', 'function rrShowStopShare', t)
    t2 = re.sub(r'(?:async\s+)+function rrSpecialStopSharing', 'function rrSpecialStopSharing', t2)
    t2 = t2.replace('function rrSpecialStopSharing(opts)', 'async function rrSpecialStopSharing(opts)', 1)
    print(path, 'changed', t2 != t)
    p.write_text(t2, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
