from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    broken = 'async ' + chr(10) + '    function rrShowStopShare'
    t2 = t.replace(broken, 'function rrShowStopShare')
    t2 = t2.replace('function rrSpecialStopSharing(opts)', 'async function rrSpecialStopSharing(opts)')
    print(path, 'show', broken in t, 'stop', 'function rrSpecialStopSharing(opts)' in t)
    if t2 == t:
        print('no change', path)
        return
    p.write_text(t2, encoding='utf-8')
    print('fixed', path)

patch('index.html')
patch('mytrips/index.html')
