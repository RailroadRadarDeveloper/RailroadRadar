from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('max-height: min(72vh, 580px) !important;', 'max-height: min(48vh, 320px) !important;')
    t = t.replace('max-height: min(42vh, 340px);', 'max-height: 200px;')
    t = t.replace('#map {\n      position: fixed;\n      top: 96px;', '#map {\n      position: fixed;\n      top: 60px;')
    t = t.replace('margin-top: 96px;', 'margin-top: 60px;')
    p.write_text(t, encoding='utf-8')
    print(path, '72vh left', t.count('72vh'), '96px map', t.count('top: 96px'))

patch('index.html')
patch('mytrips/index.html')
