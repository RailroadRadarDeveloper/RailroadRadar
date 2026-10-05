from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t2 = t.replace('async async function rrSpecialStopSharing', 'async function rrSpecialStopSharing')
    t2 = t2.replace('async async async function rrSpecialStopSharing', 'async function rrSpecialStopSharing')
    print(path, 'doubled', 'async async function rrSpecialStopSharing' in t)
    if t2 == t:
        print('no change', path)
        return
    p.write_text(t2, encoding='utf-8')
    print('fixed', path)

patch('index.html')
patch('mytrips/index.html')
