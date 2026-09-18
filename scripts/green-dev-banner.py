from pathlib import Path
p = Path('index.html')
t = p.read_text(encoding='utf-8')
old = '''    .rr-dev-banner {
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      height: 36px;
      z-index: 9998;
      background: #0c1448;
      border-bottom: 1px solid #1a3a5f;'''
new = '''    .rr-dev-banner {
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      height: 36px;
      z-index: 9998;
      background: #0ac700;
      border-bottom: 1px solid #089e00;'''
if old not in t:
    if 'background: #0ac700' in t and '.rr-dev-banner' in t:
        print('already green')
    else:
        t2 = t.replace('background: #0c1448;\n      border-bottom: 1px solid #1a3a5f;', 'background: #0ac700;\n      border-bottom: 1px solid #089e00;', 1)
        if t2 == t:
            raise SystemExit('banner css not found')
        t = t2
else:
    t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')
print('banner is green')
