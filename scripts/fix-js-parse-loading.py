from pathlib import Path

BROKEN = '''          #offline-banner.offline-banner { display: none; }
    #offline-banner.offline-banner.visible { display: block; }
      function updateOnlineStatus() {'''

FIXED = '''      function updateOnlineStatus() {'''

STYLE = '''  <style id="rr-loading-fix">
    #offline-banner.offline-banner { display: none; }
    #offline-banner.offline-banner.visible { display: block; }
    #loading-screen { z-index: 100000; }
    #rr-rail-picker.is-open { display: flex !important; z-index: 100002; }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if BROKEN in t:
        t = t.replace(BROKEN, FIXED, 1)
        print('removed css-in-js', path)
    else:
        t = t.replace('#offline-banner.offline-banner { display: none; }\n    #offline-banner.offline-banner.visible { display: block; }\n', '', 1)
        print('fallback strip', path)
    if 'id="rr-loading-fix"' not in t:
        t = t.replace('</head>', STYLE + '</head>', 1)
    old_prog = '''      function setLoadingProgress(percent, message) {
        const bar = document.getElementById('loading-bar');
        const p = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        if (bar) bar.style.width = p + '%';
      }'''
    new_prog = '''      function setLoadingProgress(percent, message) {
        const bar = document.getElementById('loading-bar');
        const p = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        if (bar) bar.style.width = p + '%';
        const text = document.getElementById('loading-text');
        if (text && message) text.textContent = message;
      }'''
    if old_prog in t:
        t = t.replace(old_prog, new_prog, 1)
    t = t.replace(
        '        try { hideLoadingScreen(); } catch (_) {}\n        const el = document.getElementById(\'rr-rail-picker\');',
        '        try { setLoadingProgress(22, \'Choose railroads to load...\'); } catch (_) {}\n        const el = document.getElementById(\'rr-rail-picker\');',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('done', path)

patch('index.html')
patch('mytrips/index.html')
