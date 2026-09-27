from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        'overflow-y: auto;\n      max-height: 380px;',
        'overflow-y: auto;\n      max-height: 460px;',
        1,
    )
    t = t.replace(
        'max-height: min(380px, 62vh);',
        'max-height: min(460px, 70vh);',
        1,
    )
    t = t.replace(
        'max-height: 230px;\n      overflow-y: auto;\n      border: 1px solid #e6e9ef;',
        'max-height: 280px;\n      overflow-y: auto;\n      border: 1px solid #e6e9ef;',
        1,
    )
    t = t.replace(
        'max-height: 250px;\n      overflow-y: auto;\n      overflow-x: hidden;',
        'max-height: 300px;\n      overflow-y: auto;\n      overflow-x: hidden;',
        1,
    )
    t = t.replace(
        '.departures-list {\n      list-style: none;\n      padding: 0;\n      margin: 0;\n      max-height: 360px;',
        '.departures-list {\n      list-style: none;\n      padding: 0;\n      margin: 0;\n      max-height: 420px;',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('380 left', t.count('max-height: 380px'), path)

patch('index.html')
patch('mytrips/index.html')
