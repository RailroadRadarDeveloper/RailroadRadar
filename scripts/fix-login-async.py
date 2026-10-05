from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t2 = t.replace('async \n    function rrShowStopShare(on) {', 'function rrShowStopShare(on) {')
    t2 = t2.replace('function rrSpecialStopSharing(opts) {', 'async function rrSpecialStopSharing(opts) {')
    if t2 == t:
        print('no change', path)
    else:
        p.write_text(t2, encoding='utf-8')
        print('fixed', path)

patch('index.html')
patch('mytrips/index.html')
