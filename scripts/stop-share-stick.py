from pathlib import Path

def strip(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    start = t.find('<style id="rr-live-bar-css">')
    end = t.find('</script>', t.find('id="rr-live-bar-js"'))
    if start >= 0 and end > start:
        t = t[:start] + t[end + len('</script>'):]
        print('stripped inline', path)
    if 'live-share-bar.js' not in t and '</body>' in t:
        t = t.replace('</body>', '<script src="/assets/js/live-share-bar.js" defer></script>\n</body>', 1)
        print('added src', path)
    p.write_text(t, encoding='utf-8')

strip('index.html')
strip('mytrips/index.html')
