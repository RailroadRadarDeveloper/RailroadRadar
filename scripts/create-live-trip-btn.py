from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        '<button type="button" class="rr-btn" id="trip-log-primary-log" hidden>Log a trip</button>',
        '<button type="button" class="rr-btn" id="trip-log-primary-log" hidden>Log a trip</button>\n          <button type="button" class="rr-btn secondary" id="trip-log-live" hidden>Create live trip</button>',
        1,
    )
    t = t.replace(
        '<button type="button" class="trip-log-empty-cta" id="trip-log-empty-cta">Log a trip</button>',
        '<button type="button" class="trip-log-empty-cta" id="trip-log-empty-cta">Log a trip</button>\n            <button type="button" class="trip-log-empty-cta trip-log-empty-live" id="trip-log-empty-live">Create live trip</button>',
        1,
    )
    t = t.replace(
        'if (primary) primary.hidden = !show;',
        'if (primary) primary.hidden = !show;\n        const liveBtn = document.getElementById(\'trip-log-live\');\n        if (liveBtn) liveBtn.hidden = !show;',
        1,
    )
    js = '''
      function openLiveTripForm() {
        switchTripLogTab('log');
        const cb = document.getElementById('trip-log-special-move');
        if (cb) {
          cb.checked = true;
          cb.dataset.locAsked = '';
        }
        try { if (typeof rrSpecialSyncTitleWrap === 'function') rrSpecialSyncTitleWrap(); } catch (_) {}
        const te = document.getElementById('trip-log-train-title');
        if (te) te.focus();
      }
      function openRegularTripForm() {
        const cb = document.getElementById('trip-log-special-move');
        if (cb) cb.checked = false;
        try { if (typeof rrSpecialSyncTitleWrap === 'function') rrSpecialSyncTitleWrap(); } catch (_) {}
        switchTripLogTab('log');
      }
'''
    if 'function openLiveTripForm' not in t:
        t = t.replace(
            "if (primaryLog) primaryLog.addEventListener('click', function() { switchTripLogTab('log'); });",
            js + "if (primaryLog) primaryLog.addEventListener('click', openRegularTripForm);\n      const liveLog = document.getElementById('trip-log-live');\n      if (liveLog) liveLog.addEventListener('click', openLiveTripForm);\n      const emptyLive = document.getElementById('trip-log-empty-live');\n      if (emptyLive) emptyLive.addEventListener('click', openLiveTripForm);",
            1,
        )
        t = t.replace(
            "if (emptyCta) emptyCta.addEventListener('click', function() { switchTripLogTab('log'); });",
            "if (emptyCta) emptyCta.addEventListener('click', openRegularTripForm);",
            1,
        )
        print('wired', path)
    css = '''
    html.rr-mytrips-page #trip-log-live { display: inline-flex; align-items: center; min-height: 36px; }
    .trip-log-empty-live { margin-left: 8px; background: #fff !important; color: #07093e !important; border: 1px solid #07093e !important; }
'''
    if 'id="rr-live-trip-btn"' not in t:
        t = t.replace('</head>', '<style id="rr-live-trip-btn">' + css + '</style>\n</head>', 1)
    p.write_text(t, encoding='utf-8')
    print('done', path, 'live btn', t.count('trip-log-live'))

patch('index.html')
patch('mytrips/index.html')
