from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        '<div style="width: 280px; height: 6px; background: #07093e; border-radius: 3px; overflow: hidden; margin-bottom: 12px;">',
        '<div style="width: 280px; height: 8px; background: rgba(255,255,255,0.18); border-radius: 4px; overflow: hidden; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.22);">',
        1,
    )
    t = t.replace(
        '''      function setLoadingProgress(percent, message) {
        const bar = document.getElementById('loading-bar');
        const p = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        if (bar) bar.style.width = p + '%';
      }''',
        '''      function setLoadingProgress(percent, message) {
        const bar = document.getElementById('loading-bar');
        const p = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        if (bar) bar.style.width = p + '%';
        const text = document.getElementById('loading-text');
        if (text && message) text.textContent = message;
      }''',
        1,
    )
    t = t.replace(
        '''    function showRailPickerUi() {
        try { hideLoadingScreen(); } catch (_) {}
        const el = document.getElementById('rr-rail-picker');''',
        '''    function showRailPickerUi() {
        try { setLoadingProgress(20, 'Choose railroads to load...'); } catch (_) {}
        const el = document.getElementById('rr-rail-picker');''',
        1,
    )
    old_hide = '''        setLoadingProgress(100, 'Ready!');
        setLoadingTip('No defects. Detector out. ✌\ufe0f');
        loadingScreen.style.display = 'none';'''
    new_hide = '''        setLoadingProgress(100, 'Ready!');
        try { setLoadingTip('No defects. Detector out. ✌\ufe0f'); } catch (_) {}
        loadingScreen.style.opacity = '0';
        loadingScreen.style.pointerEvents = 'none';
        setTimeout(function() {
          loadingScreen.style.display = 'none';
        }, 400);'''
    if old_hide in t:
        t = t.replace(old_hide, new_hide, 1)
        print('fade hide', path)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
