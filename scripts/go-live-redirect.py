from pathlib import Path

OLD = '''document.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('#trip-log-go-live');
      if (!btn) return;
      ev.preventDefault();
      var cb = document.getElementById('trip-log-special-move');
      if (cb) cb.checked = true;
      Promise.resolve(typeof saveTripLog === 'function' ? saveTripLog() : null).then(function() {
        var user = (typeof rrAuthUser === 'function') ? rrAuthUser() : (typeof currentUser !== 'undefined' ? currentUser : null);
        if (user && user.uid) location.href = '/live/user.html?uid=' + encodeURIComponent(user.uid);
      }).catch(function() {});
    });'''

NEW = '''document.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('#trip-log-go-live');
      if (!btn) return;
      ev.preventDefault();
      var cb = document.getElementById('trip-log-special-move');
      if (cb) cb.checked = true;
      var user = null;
      try { user = (typeof rrAuthUser === 'function') ? rrAuthUser() : null; } catch (e) {}
      if (!user) try { user = window.currentUser || null; } catch (e) {}
      if (!user && window.firebase && firebase.auth) try { user = firebase.auth().currentUser; } catch (e) {}
      if (!user || !user.uid) { alert('Sign in before going live.'); return; }
      var titleEl = document.getElementById('trip-log-train-title');
      var title = titleEl && titleEl.value ? titleEl.value.trim() : 'Live trip';
      var go = function() { location.href = '/live/user.html?uid=' + encodeURIComponent(user.uid); };
      try { if (typeof saveTripLog === 'function') saveTripLog(); } catch (e) {}
      if (!navigator.geolocation) { go(); return; }
      navigator.geolocation.getCurrentPosition(function(pos) {
        var now = Date.now();
        var share = { uid: user.uid, tripId: 'live-' + now, title: title.slice(0, 80), startedAt: now, expiresAt: now + 5 * 60 * 60 * 1000, updatedAt: now, lastLat: pos.coords.latitude, lastLon: pos.coords.longitude };
        try { localStorage.removeItem('rrSpecialShareStopped'); localStorage.setItem('rrSpecialMoveShareV1', JSON.stringify(share)); } catch (e) {}
        var write = (window.db || (firebase.firestore && firebase.firestore())).collection('specialMoveShares').doc(user.uid).set({
          uid: user.uid, displayName: (user.displayName || 'Rider').split(' ')[0], tripId: share.tripId, title: share.title, active: true,
          lat: pos.coords.latitude, lon: pos.coords.longitude, heading: pos.coords.heading, startedAt: now, expiresAt: share.expiresAt, updatedAt: now
        }, { merge: true });
        Promise.resolve(write).then(go).catch(go);
      }, go, { enableHighAccuracy: true, timeout: 8000 });
    });'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD not in t:
        print('missing', path)
        return
    p.write_text(t.replace(OLD, NEW, 1), encoding='utf-8')
    print('updated', path)

patch('index.html')
patch('mytrips/index.html')
