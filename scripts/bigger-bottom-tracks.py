from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        'background-size: min(480px, 60vw), min(520px, 70vw);',
        'background-size: min(480px, 60vw), min(720px, 88vw);',
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path, t.count('min(720px, 88vw)'))

patch('index.html')
patch('mytrips/index.html')
