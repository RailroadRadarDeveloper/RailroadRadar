from pathlib import Path
TAG = '<script src="/assets/js/live-share-bar.js" defer></script>\n'
for path in Path('.').rglob('*.html'):
    if 'node_modules' in path.parts:
        continue
    t = path.read_text(encoding='utf-8', errors='replace')
    if 'live-share-bar.js' in t:
        print('has', path)
        continue
    if '</body>' not in t:
        print('no body', path)
        continue
    path.write_text(t.replace('</body>', TAG + '</body>', 1), encoding='utf-8')
    print('added', path)
