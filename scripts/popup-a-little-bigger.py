from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('transform: scale(0.78);', 'transform: scale(0.88);')
    t = t.replace('transform: scale(0.74);', 'transform: scale(0.84);')
    p.write_text(t, encoding='utf-8')
    print(path, '0.88', t.count('scale(0.88)'), '0.84', t.count('scale(0.84)'))

patch('index.html')
patch('mytrips/index.html')
