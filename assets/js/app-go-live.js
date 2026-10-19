
    document.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('#trip-log-go-live');
      if (!btn) return;
      ev.preventDefault();
      var cb = document.getElementById('trip-log-special-move');
      if (cb) cb.checked = true;
      var user = null;
      try { user = (typeof rrAuthUser === 'function') ? rrAuthUser() : null; } catch (e) {}
      if (!user) try { user = window.currentUser; } catch (e) {}
      if (!user && window.firebase && firebase.auth) try { user = firebase.auth().currentUser; } catch (e) {}
      if (!user || !user.uid) { alert('Sign in before going live.'); return; }
      var title = ((document.getElementById('trip-log-train-title') || {}).value || 'Live trip').trim().slice(0, 80);
      var icon = ((document.getElementById('trip-log-live-icon') || {}).value || '/assets/hsp46.png');
      function newShareCode() {
        try {
          var a = new Uint8Array(10);
          crypto.getRandomValues(a);
          var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
          var s = '';
          for (var i = 0; i < a.length; i++) s += alphabet[a[i] % 36];
          return s;
        } catch (e) {
          return ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 12);
        }
      }
      var shareCode = newShareCode();
      var go = function() { location.href = '/live/user.html?s=' + encodeURIComponent(shareCode); };
      var savedTripId = null;
      var finish = function(pos) {
        var now = Date.now();
        var cur = window.rrSpecialShareState;
        var share = {
          uid: user.uid,
          shareCode: shareCode,
          tripId: savedTripId,
          title: title,
          icon: icon,
          startedAt: (cur && cur.startedAt) || now,
          expiresAt: (cur && cur.expiresAt) || (now + 5 * 60 * 60 * 1000),
          updatedAt: now
        };
        if (pos && pos.coords) { share.lastLat = pos.coords.latitude; share.lastLon = pos.coords.longitude; }
        try { localStorage.removeItem('rrSpecialShareStopped'); localStorage.setItem('rrSpecialMoveShareV1', JSON.stringify(share)); } catch (e) {}
        var db = window.db || (firebase.firestore && firebase.firestore());
        if (!db || !pos || !pos.coords) { go(); return; }
        var prevCode = cur && cur.shareCode;
        var writes = [];
        if (prevCode && prevCode !== shareCode) {
          writes.push(db.collection('specialMoveShares').doc(prevCode).delete().catch(function() {}));
        }
        // Drop a legacy uid-keyed doc if one is still around.
        writes.push(db.collection('specialMoveShares').doc(user.uid).delete().catch(function() {}));
        writes.push(db.collection('specialMoveShares').doc(shareCode).set({
          uid: user.uid, displayName: (user.displayName || 'Rider').split(' ')[0], tripId: share.tripId, title: title, icon: icon, active: true,
          lat: pos.coords.latitude, lon: pos.coords.longitude, heading: pos.coords.heading, startedAt: share.startedAt, expiresAt: share.expiresAt, expireAt: firebase.firestore.Timestamp.fromMillis(Number(share.expiresAt)), updatedAt: now
        }, { merge: true }));
        Promise.all(writes).then(go).catch(go);
      };
      // Save the trip first (it must exist with its stations), then share under its real id.
      Promise.resolve(typeof saveTripLog === 'function' ? saveTripLog() : null).then(function(id) {
        if (!id) return; // save failed or was blocked; the form shows why
        savedTripId = id;
        if (!navigator.geolocation) finish(null);
        else navigator.geolocation.getCurrentPosition(finish, function() { finish(null); }, { enableHighAccuracy: true, timeout: 8000 });
      }).catch(function(e) { console.warn('[go-live] save failed', e); });
    });
