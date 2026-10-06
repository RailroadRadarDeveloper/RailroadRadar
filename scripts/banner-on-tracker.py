from pathlib import Path
p = Path('live/user.html')
t = p.read_text(encoding='utf-8')
if 'live-share-bar.js' not in t:
    t = t.replace('</body>', '<script src="/assets/js/live-share-bar.js"></script>\n</body>', 1)
    p.write_text(t, encoding='utf-8')
    print('added')
else:
    print('already')
bar = Path('assets/js/live-share-bar.js')
b = bar.read_text(encoding='utf-8')
if 'rr-banner-poll' not in b:
    b = b.replace(
        'if (document.body) boot(); else document.addEventListener(\'DOMContentLoaded\', boot);',
        'if (document.body) boot(); else document.addEventListener(\'DOMContentLoaded\', boot);\n  setInterval(function(){ if (!stopped()) { var cur = read(); if (cur) show(cur); } }, 2000);\n  window.__rrBannerPoll = true;',
        1,
    )
    bar.write_text(b, encoding='utf-8')
    print('poll')
