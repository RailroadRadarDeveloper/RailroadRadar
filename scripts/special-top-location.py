from pathlib import Path

OLD_BLOCK = '''            <div class="trip-log-segments" id="trip-log-segments"></div>
            <button type="button" class="rr-btn secondary" id="trip-log-add-segment">Add another train</button>
            <div class="trip-special-block" id="trip-special-block">
              <label class="trip-special-toggle" for="trip-log-special-move">
                <input type="checkbox" id="trip-log-special-move">
                <span>Special move / extra</span>
              </label>
              <div id="trip-special-title-wrap" hidden>
                <label for="trip-log-train-title">Map title</label>
                <input type="text" id="trip-log-train-title" maxlength="80" placeholder="e.g. Berkshire Flyer special" autocomplete="off">
              </div>
            </div>'''

NEW_BLOCK = '''            <div class="trip-special-block" id="trip-special-block">
              <label class="trip-special-toggle" for="trip-log-special-move">
                <input type="checkbox" id="trip-log-special-move">
                <span>Special move / extra</span>
              </label>
              <div id="trip-special-title-wrap" hidden>
                <label for="trip-log-train-title">Map title</label>
                <input type="text" id="trip-log-train-title" maxlength="80" placeholder="e.g. Berkshire Flyer special" autocomplete="off">
                <p class="trip-special-loc" id="trip-special-loc">Location is requested when you check Special move.</p>
              </div>
            </div>
            <div class="trip-log-segments" id="trip-log-segments"></div>
            <button type="button" class="rr-btn secondary" id="trip-log-add-segment">Add another train</button>'''

CSS = '''
    body.trip-form-special #trip-log-segments,
    body.trip-form-special #trip-log-add-segment,
    body.trip-form-special #trip-log-miles-preview { display: none !important; }
    .trip-special-loc { margin: 6px 0 0; font-size: 13px; color: #3a4250; }
'''

JS = '''
    function rrSpecialAskLocation() {
      const el = document.getElementById('trip-special-loc');
      if (!navigator.geolocation) {
        if (el) el.textContent = 'Location is not supported in this browser.';
        return;
      }
      if (el) el.textContent = 'Requesting location permission…';
      navigator.geolocation.getCurrentPosition(function() {
        if (el) el.textContent = 'Location allowed. You can share this move on the live map after saving.';
      }, function(err) {
        if (el) el.textContent = (err && err.code === 1)
          ? 'Location permission denied. Allow location to share this move.'
          : 'Location unavailable. You can try again from the trip after saving.';
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_BLOCK in t:
        t = t.replace(OLD_BLOCK, NEW_BLOCK, 1)
        print('moved', path)
    else:
        print('block missing', path)
    if 'id="rr-special-top"' not in t:
        t = t.replace('</head>', '<style id="rr-special-top">' + CSS + '</style>\n</head>', 1)
    if 'function rrSpecialAskLocation' not in t:
        t = t.replace('function rrSpecialSyncTitleWrap() {', JS + 'function rrSpecialSyncTitleWrap() {', 1)
    old = '''      const on = !!(cb && cb.checked);
      wrap.hidden = !on;
      if (block) block.classList.toggle('is-on', on);'''
    new = '''      const on = !!(cb && cb.checked);
      wrap.hidden = !on;
      if (block) block.classList.toggle('is-on', on);
      document.body.classList.toggle('trip-form-special', on);
      if (on && !cb.dataset.locAsked) {
        cb.dataset.locAsked = '1';
        try { rrSpecialAskLocation(); } catch (_) {}
      }'''
    if old in t:
        t = t.replace(old, new, 1)
        print('hook', path)
    else:
        print('hook missing', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
