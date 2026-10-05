from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    old = '    async \n    function rrShowStopShare(on) {'
    new = '    function rrShowStopShare(on) {'
    if old in t:
        t = t.replace(old, new, 1)
        print('stray async', path)
    else:
        print('stray missing', path)
    t = t.replace('function rrSpecialStopSharing(opts) {', 'async function rrSpecialStopSharing(opts) {', 1)
    p.write_text(t, encoding='utf-8')
    print('async restored', path)

patch('index.html')
patch('mytrips/index.html')
