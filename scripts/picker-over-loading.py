from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        '#rr-rail-picker.is-open {\n      display: flex;\n    }',
        '#rr-rail-picker.is-open {\n      display: flex !important;\n      z-index: 100002;\n    }',
        1,
    )
    old = '''    function showRailPickerUi() {
        const el = document.getElementById('rr-rail-picker');
        if (!el) return;
        el.hidden = false;
        el.setAttribute('aria-hidden', 'false');
        el.classList.add('is-open');
        updateRailPickerGoEnabled();
      }'''
    new = '''    function showRailPickerUi() {
        try { hideLoadingScreen(); } catch (_) {}
        const el = document.getElementById('rr-rail-picker');
        if (!el) return;
        el.hidden = false;
        el.removeAttribute('hidden');
        el.setAttribute('aria-hidden', 'false');
        el.classList.add('is-open');
        updateRailPickerGoEnabled();
      }'''
    if old in t:
        t = t.replace(old, new, 1)
        print('showRailPickerUi patched', path)
    else:
        print('showRailPickerUi missing', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
