from pathlib import Path

CSS = '''    html.rr-mytrips-page.rr-mytrips-guest,
    html.rr-mytrips-page.rr-mytrips-guest body,
    html.rr-mytrips-page .mytrips-guest {
      cursor: url('/assets/brand/mytrips-cursor.png') 16 16, auto;
    }
    html.rr-mytrips-page .mytrips-guest a,
    html.rr-mytrips-page .mytrips-guest button {
      cursor: url('/assets/brand/mytrips-cursor.png') 16 16, pointer;
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if "url('/assets/brand/mytrips-cursor.png')" in t:
        print('already', path)
        return
    needle = '    html.rr-mytrips-page.rr-mytrips-guest,'
    if needle in t:
        t = t.replace(needle, CSS + needle, 1)
    else:
        t = t.replace('.mytrips-guest[hidden]', CSS + '    .mytrips-guest[hidden]', 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
