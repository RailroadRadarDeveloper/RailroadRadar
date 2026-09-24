from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        'background-position: top -40px right -60px, bottom left -80px;',
        'background-position: top -40px right -60px, left -80px bottom -90px;',
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path, t.count('bottom -90px'))

patch('index.html')
patch('mytrips/index.html')
