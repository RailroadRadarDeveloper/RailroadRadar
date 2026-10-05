from pathlib import Path

ASK = '''
    function rrSpecialRequireLocation() {
      return new Promise(function(resolve, reject) {
        if (!navigator.geolocation) {
          reject(new Error('Location is not supported in this browser.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(function(pos) {
          const fix = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          window.rrSpecialLastFix = fix;
          const el = document.getElementById('trip-special-loc');
          if (el) el.textContent = 'Location allowed.';
          const saveBtn = document.getElementById('trip-log-save');
          if (saveBtn) saveBtn.disabled = false;
          resolve(fix);
        }, function(err) {
          const saveBtn = document.getElementById('trip-log-save');
          if (saveBtn) saveBtn.disabled = true;
          const el = document.getElementById('trip-special-loc');
          if (el) el.textContent = (err && err.code === 1)
            ? 'Location is required. Allow location to create this trip.'
            : 'Location is required and was not available.';
          reject(new Error('Location is required before this trip can be created.'));
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      });
    }
'''

OLD = '''      if (specialFields.specialMove && !specialFields.trainTitle) {
        setTripLogError('Special move needs a map title (e.g. Berkshire Flyer special).');
        try {
          const tw = document.getElementById('trip-special-title-wrap');
          if (tw) tw.hidden = false;
          const te = document.getElementById('trip-log-train-title');
          if (te) te.focus();
        } catch (_) {}
        return;
      }'''

NEW = '''      if (specialFields.specialMove && !specialFields.trainTitle) {
        setTripLogError('Special move needs a map title (e.g. Berkshire Flyer special).');
        try {
          const tw = document.getElementById('trip-special-title-wrap');
          if (tw) tw.hidden = false;
          const te = document.getElementById('trip-log-train-title');
          if (te) te.focus();
        } catch (_) {}
        return;
      }
      if (specialFields.specialMove) {
        try {
          window.rrSpecialLastFix = await rrSpecialRequireLocation();
        } catch (locErr) {
          setTripLogError((locErr && locErr.message) || 'Location is required before this trip can be created.');
          return;
        }
      }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function rrSpecialRequireLocation' not in t:
        t = t.replace('function rrSpecialSyncTitleWrap() {', ASK + 'function rrSpecialSyncTitleWrap() {', 1)
        print('ask', path)
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        print('save', path)
    else:
        print('save missing', path)
    t = t.replace(
        "if (on && !cb.dataset.locAsked) {\n        cb.dataset.locAsked = '1';\n        try { rrSpecialAskLocation(); } catch (_) {}",
        "if (on) {\n        const saveBtn = document.getElementById('trip-log-save');\n        if (saveBtn && !(window.rrSpecialLastFix && window.rrSpecialLastFix.lat != null)) saveBtn.disabled = true;\n        if (!cb.dataset.locAsked) {\n          cb.dataset.locAsked = '1';\n          try { rrSpecialRequireLocation().catch(function() {}); } catch (_) {}\n        }",
        1,
    )
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
