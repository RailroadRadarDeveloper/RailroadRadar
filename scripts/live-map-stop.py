from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        '<button type="button" class="rr-btn" id="trip-log-save">Save trip</button>',
        '<button type="button" class="rr-btn" id="trip-log-save">Save trip</button>\n              <button type="button" class="rr-btn secondary" id="trip-log-stop-share" hidden>Stop sharing</button>',
        1,
    )
    t = t.replace(
        "const stopBtn = document.getElementById('trip-detail-stop-share');",
        "const stopBtn = document.getElementById('trip-detail-stop-share');\n      const formStop = document.getElementById('trip-log-stop-share');",
        1,
    )
    t = t.replace(
        '''      if (stopBtn) {
        stopBtn.hidden = !sharing;
        stopBtn.disabled = false;
      }''',
        '''      if (stopBtn) {
        stopBtn.hidden = !sharing;
        stopBtn.disabled = false;
      }
      if (formStop) {
        formStop.hidden = !sharing;
        formStop.disabled = false;
      }''',
        1,
    )
    old = '''        if (typeof showNotification === 'function') showNotification(editingId ? 'Trip updated' : 'Trip saved');
        tripLogEditingId = null;'''
    new = '''        if (specialFields.specialMove && typeof rrSpecialStartSharing === 'function') {
          const shareData = Object.assign({}, payload, {
            specialMove: true,
            trainTitle: specialFields.trainTitle,
            userId: uid
          });
          try {
            await rrSpecialStartSharing(tripRef.id, shareData);
            if (window.rrSpecialLastFix && rrSpecialShareState && typeof rrSpecialWriteShare === 'function') {
              await rrSpecialWriteShare({
                latitude: window.rrSpecialLastFix.lat,
                longitude: window.rrSpecialLastFix.lon
              }, { force: true });
            }
            if (typeof rrSpecialStartMapListener === 'function') rrSpecialStartMapListener();
            if (typeof showNotification === 'function') showNotification('Live on the map. Use Stop sharing to end it.');
          } catch (shareErr) {
            console.warn('[special-share] start after save', shareErr);
            if (typeof showNotification === 'function') showNotification(editingId ? 'Trip updated' : 'Trip saved');
          }
        } else if (typeof showNotification === 'function') showNotification(editingId ? 'Trip updated' : 'Trip saved');
        tripLogEditingId = null;'''
    if old in t:
        t = t.replace(old, new, 1)
        print('save hook', path)
    else:
        print('save hook missing', path)
    if "getElementById('trip-log-stop-share')" not in t[t.find('openLiveTripForm'):t.find('openLiveTripForm')+2500] if 'openLiveTripForm' in t else True:
        t = t.replace(
            "if (liveLog) liveLog.addEventListener('click', openLiveTripForm);",
            "if (liveLog) liveLog.addEventListener('click', openLiveTripForm);\n      const formStop = document.getElementById('trip-log-stop-share');\n      if (formStop) formStop.addEventListener('click', function() {\n        if (typeof rrSpecialStopSharing === 'function') rrSpecialStopSharing({ reason: 'user' });\n        formStop.hidden = true;\n        if (typeof showNotification === 'function') showNotification('Stopped sharing');
      });",
            1,
        )
        print('stop wire', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
