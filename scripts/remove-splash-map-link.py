from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('\n          <a class="mytrips-guest-map" href="/">Back to the live map</a>', '')
    t = t.replace('\n        <a class="mytrips-guest-map" href="/">Back to the live map</a>', '')
    p.write_text(t, encoding='utf-8')
    print('patched', path, t.count('Back to the live map'))

patch('index.html')
patch('mytrips/index.html')
