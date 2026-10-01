from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        "html.rr-banned #map, html.rr-banned .header, html.rr-banned #loading-screen { display:none !important; }",
        "html.rr-banned #map, html.rr-banned #loading-screen { display:none !important; } html.rr-banned .header { display:flex !important; z-index:100000 !important; }",
    )
    t = t.replace(
        'id="rr-banned-screen" hidden style="display:none;position:fixed;inset:0;z-index:2147483000;background:#07093e;',
        'id="rr-banned-screen" hidden style="display:none;position:fixed;top:60px;left:0;right:0;bottom:0;z-index:9000;background:#07093e;',
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'header hide left', '.header, html.rr-banned #loading' in t)

patch('index.html')
patch('mytrips/index.html')
