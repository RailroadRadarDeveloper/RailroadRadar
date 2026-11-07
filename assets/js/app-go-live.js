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

  function publish(pos) {
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
    share.lastLat = pos.coords.latitude;
    share.lastLon = pos.coords.longitude;
    try { localStorage.removeItem('rrSpecialShareStopped'); localStorage.setItem('rrSpecialMoveShareV1', JSON.stringify(share)); } catch (e) {}
    var db = window.db || (firebase.firestore && firebase.firestore());
    if (!db) {
      alert('Your trip was saved, but live location could not connect. Please try Go Live again.');
      return;
    }
    var prevCode = cur && cur.shareCode;
    var writes = [];
    if (prevCode && prevCode !== shareCode) {
      writes.push(db.collection('specialMoveShares').doc(prevCode).delete().catch(function() {}));
    }
    // Drop a legacy uid-keyed doc if one is still around.
    writes.push(db.collection('specialMoveShares').doc(user.uid).delete().catch(function() {}));
    writes.push(db.collection('specialMoveShares').doc(shareCode).set({
      uid: user.uid, displayName: (user.displayName || 'Rider').split(' ')[0], tripId: share.tripId, title: title, icon: icon, active: true,
      lat: pos.coords.latitude, lon: pos.coords.longitude, heading: pos.coords.heading, speed: pos.coords.speed,
      startedAt: share.startedAt, expiresAt: share.expiresAt,
      expireAt: firebase.firestore.Timestamp.fromMillis(Number(share.expiresAt)), updatedAt: now
    }, { merge: true }));
    Promise.all(writes).then(go).catch(function(e) {
      console.warn('[go-live] share write failed', e);
      alert('Your trip was saved, but live location could not be published. Please try Go Live again.');
    });
  }

  function requestAccurateLocation() {
    if (!navigator.geolocation) {
      alert('Your trip was saved, but this browser does not provide location. Live tracking was not started.');
      return;
    }
    var settled = false;
    var watchId = null;
    var timeoutId = null;
    var options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      if (watchId != null) {
        try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
        watchId = null;
      }
    }
    function fail() {
      if (settled) return;
      settled = true;
      cleanup();
      alert('Your trip was saved, but RailroadRadar could not get an accurate current location. Check location permission and GPS, then try Go Live again. Live tracking was not started.');
    }
    function accept(pos) {
      if (settled || !pos || !pos.coords) return;
      var c = pos.coords;
      var lat = Number(c.latitude);
      var lon = Number(c.longitude);
      var accuracy = Number(c.accuracy);
      var timestamp = Number(pos.timestamp) || 0;
      var age = timestamp ? Date.now() - timestamp : Infinity;
      // Reject coarse/IP-derived fixes and stale cached positions instead of publishing a guessed marker.
      if (!isFinite(lat) || lat < -90 || lat > 90 || !isFinite(lon) || lon < -180 || lon > 180 ||
          !isFinite(accuracy) || accuracy <= 0 || accuracy > 1500 || age < -5000 || age > 60000) return;
      settled = true;
      cleanup();
      publish(pos);
    }
    function startWatch() {
      if (settled || watchId != null) return;
      try { watchId = navigator.geolocation.watchPosition(accept, function() {}, options); }
      catch (e) { fail(); }
    }

    timeoutId = setTimeout(fail, 30000);
    try {
      navigator.geolocation.getCurrentPosition(function(pos) {
        accept(pos);
        if (!settled) startWatch();
      }, function() {
        startWatch();
      }, options);
    } catch (e) {
      startWatch();
    }
  }

  // Save the trip first (it must exist with its stations), then require a fresh,
  // reasonably precise device fix before publishing a live marker.
  Promise.resolve(typeof saveTripLog === 'function' ? saveTripLog() : null).then(function(id) {
    if (!id) return; // save failed or was blocked; the form shows why
    savedTripId = id;
    requestAccurateLocation();
  }).catch(function(e) { console.warn('[go-live] save failed', e); });
});
