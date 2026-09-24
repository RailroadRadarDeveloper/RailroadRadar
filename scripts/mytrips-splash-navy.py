from pathlib import Path

REPLACES = [
    ('background-color: transparent;\n      background-image:', 'background-color: #07093e;\n      background-image:'),
    ('''    html.rr-mytrips-page .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 18px 48px;
      background-color: transparent;
      color: #fff;
    }''',
     '''    html.rr-mytrips-page .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 18px 48px;
      background-color: #07093e;
      color: #fff;
    }'''),
]

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('background-color: transparent;\n      background-image:', 'background-color: #07093e;\n      background-image:')
    t = t.replace('padding: 24px 18px 48px;\n      background-color: transparent;', 'padding: 24px 18px 48px;\n      background-color: #07093e;')
    # signed-out mytrips page itself should stay navy, not white
    t = t.replace(
        '''    html.rr-mytrips-page.rr-mytrips-guest,
    html.rr-mytrips-page.rr-mytrips-guest body {
      background-color: #07093e !important;''',
        '''    html.rr-mytrips-page.rr-mytrips-guest,
    html.rr-mytrips-page.rr-mytrips-guest body {
      background: #07093e !important;
      background-color: #07093e !important;'''
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
