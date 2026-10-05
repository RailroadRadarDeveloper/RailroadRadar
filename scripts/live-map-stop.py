from pathlib import Path

HTML = '''<button type="button" id="rr-stop-share" hidden style="display:none;position:fixed;right:16px;bottom:24px;z-index:10040;background:#07093e;color:#fff;border:0;border-radius:999px;padding:12px 16px;font-weight:700;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;">Stop sharing</button>'''

JS = '''
    function rrShowStopShare(on) {
      const btn = document.getElementById('rr-stop-share');
      if (!btn) return;
      btn.hidden = !on;
      btn.style.display = on ? 'inline-flex' : 'none';
    }
    async function rrSpecialPublishLiveTrip(tripId, title, fix) {
      const user = (typeof rrAuthUser === 'function') ? rrAuthUser() : currentUser;
      if (!user || !db || !fix || fix.lat == null) return;
      const startedAt = Date.now();
      const expiresAt = startedAt + (typeof RR_SPECIAL_SHARE_MAX_MS === 'number' ? RR_SPECIAL_SHARE_MAX_MS : 5 * 60 * 60 * 1000);
      rrSpecialShareState = {
        uid: user.uid,
        tripId: tripId,
        title: String(title || 'Live trip').slice(0, 80),
        startedAt: startedAt,
        expiresAt: expiresAt,
        lastWriteAt: 0,
        lastLat: Number(fix.lat),
        lastLon: Number(fix.lon),
        offline: false
      };
      try { rrSpecialPersistLocal(rrSpecialShareState); } catch (_) {}
      await db.collection('specialMoveShares').doc(user.uid).set({
        uid: user.uid,
        tripId: tripId,
        title: rrSpecialShareState.title,
        active: true,
        lat: Number(fix.lat),
        lon: Number(fix.lon),
        startedAt: startedAt,
        expiresAt: expiresAt,
        updatedAt: startedAt
      }, { merge: true });
      try {
        if (typeof rrSpecialApplyDocs === 'function') {
          rrSpecialApplyDocs([{ data: function() { return { active: true, lat: Number(fix.lat), lon: Number(fix.lon), title: rrSpecialShareState.title, expiresAt: expiresAt, updatedAt: startedAt, uid: user.uid }; } }]);
        }
      } catch (_) {}
      try { if (typeof rrSpecialStartMapListener === 'function') rrSpecialStartMapListener(); } catch (_) {}
      rrShowStopShare(true);
      if (typeof showNotification === 'function') showNotification('Live trip is on the map');
    }
    document.addEventListener('click', function(ev) {
      const btn = ev.target && ev.target.closest && ev.target.closest('#rr-stop-share, #trip-detail-stop-share');
      if (!btn) return;
      ev.preventDefault();
      Promise.resolve(typeof rrSpecialStopSharing === 'function' ? rrSpecialStopSharing() : null).then(function() {
        rrShowStopShare(false);
      }).catch(function() { rrShowStopShare(false); });
    });
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'id="rr-stop-share"' not in t:
        t = t.replace('<body>', '<body>\n' + HTML + '\n', 1)
        print('btn', path)
    if 'function rrSpecialPublishLiveTrip' not in t:
        t = t.replace('function rrSpecialStopSharing', JS + 'function rrSpecialStopSharing', 1)
        print('js', path)
    old = "if (typeof showNotification === 'function') showNotification(editingId ? 'Trip updated' : 'Trip saved');"
    new = '''if (typeof showNotification === 'function') showNotification(editingId ? 'Trip updated' : 'Trip saved');
        if (payload && payload.specialMove && window.rrSpecialLastFix && window.rrSpecialLastFix.lat != null) {
          try {
            await rrSpecialPublishLiveTrip(tripRef.id, payload.trainTitle || payload.trainNumber || 'Live trip', window.rrSpecialLastFix);
          } catch (shareErr) {
            console.warn('[live-trip] map publish', shareErr);
            setTripLogError('Trip saved, but it could not be placed on the map yet.');
          }
        }'''
    if old in t:
        t = t.replace(old, new, 1)
        print('save hook', path)
    else:
        print('save hook missing', path)
    t = t.replace(
        'rrSpecialShareState = null;\n      rrSpecialShareQueue = [];\n      rrSpecialPersistLocal(null);',
        'rrSpecialShareState = null;\n      rrSpecialShareQueue = [];\n      rrSpecialPersistLocal(null);\n      try { rrShowStopShare(false); } catch (_) {}',
        1,
    )
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
