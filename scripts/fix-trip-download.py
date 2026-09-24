from pathlib import Path

OLD_LOAD = '''    function tripLoadImage(src) {
      return new Promise(function(resolve, reject) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() { resolve(img); };
        img.onerror = function() { reject(new Error('logo load failed')); };
        img.src = src;
      });
    }'''

NEW_LOAD = '''    function tripLoadImage(src) {
      return new Promise(function(resolve, reject) {
        const img = new Image();
        const s = String(src || '');
        if (s && !s.startsWith('data:') && !s.startsWith('blob:') && s.indexOf('railroadradar.com') < 0 && s.charAt(0) !== '/') {
          img.crossOrigin = 'anonymous';
        }
        img.onload = function() { resolve(img); };
        img.onerror = function() { reject(new Error('image load failed')); };
        img.src = s;
      });
    }'''

OLD_DL = '''    function tripDownloadPngBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'railroadradar-trip.png';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        try { URL.revokeObjectURL(url); } catch (_) {}
        try { a.remove(); } catch (_) {}
      }, 1500);
    }'''

NEW_DL = '''    function tripShowSaveLink(blob, filename) {
      const name = filename || 'railroadradar-trip.png';
      const url = URL.createObjectURL(blob);
      let bar = document.getElementById('trip-detail-save-bar');
      if (!bar) {
        const overlay = document.getElementById('trip-detail-overlay');
        bar = document.createElement('div');
        bar.id = 'trip-detail-save-bar';
        bar.style.cssText = 'position:absolute;left:12px;right:12px;bottom:12px;z-index:20;display:flex;gap:8px;justify-content:center;';
        if (overlay) overlay.appendChild(bar);
      }
      bar.innerHTML = '';
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      a.textContent = 'Save image';
      a.style.cssText = 'background:#fff;color:#07093e;font-weight:800;font-size:14px;padding:12px 18px;text-decoration:none;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);';
      bar.appendChild(a);
      bar.hidden = false;
      return url;
    }
    function tripDownloadPngBlob(blob, filename) {
      const name = filename || 'railroadradar-trip.png';
      const url = tripShowSaveLink(blob, name);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { try { a.remove(); } catch (_) {} }, 2000);
      } catch (_) {}
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_LOAD in t:
        t = t.replace(OLD_LOAD, NEW_LOAD, 1)
    else:
        print('load fn not exact', path)
    if OLD_DL in t:
        t = t.replace(OLD_DL, NEW_DL, 1)
    else:
        print('download fn not exact', path)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
