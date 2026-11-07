/* Admin-only GPS fallback for MBTA timetable trains without a native location feed. */
(function () {
  'use strict';
  if (window.__rrAdminMbtaTrainShare) return;
  window.__rrAdminMbtaTrainShare = true;

  var db = null, auth = null, adminPromise = null, currentShare = null, watchId = null;
  var markers = Object.create(null), suppressed = Object.create(null), feedPositions = Object.create(null);
  var nativeFetch = window.fetch;
  var MAP = function () { return window.rrMainMap || null; };
  var BOOTSTRAP = ['turokerr@gmail.com', 'railroadradar@gmail.com'];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
  function randomCode() {
    var bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789', out = '';
    for (var i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }
  function getDb() {
    if (db) return db;
    if (!window.firebase || !firebase.firestore) return null;
    db = firebase.firestore();
    return db;
  }
  function isAdmin() {
    if (adminPromise) return adminPromise;
    adminPromise = Promise.resolve().then(async function () {
      if (!window.firebase || !firebase.auth) return false;
      auth = firebase.auth();
      var user = auth.currentUser;
      if (!user || !user.email || !user.emailVerified) return false;
      var email = String(user.email).trim().toLowerCase();
      if (BOOTSTRAP.indexOf(email) !== -1) return true;
      var store = getDb();
      if (!store) return false;
      try {
        var snap = await store.collection('admins').doc(email).get();
        if (!snap.exists) return false;
        var perms = (snap.data() || {}).perms || {};
        return Object.keys(perms).some(function (key) { return perms[key] === true; });
      } catch (_) { return false; }
    }).finally(function () { setTimeout(function () { adminPromise = null; }, 15000); });
    return adminPromise;
  }
  function iconUrl(value) {
    return /^\/assets\/[A-Za-z0-9-]+\.png$/.test(String(value || '')) ? value : '/assets/hsp46.png';
  }
  function removeMarker(id) {
    if (markers[id]) {
      try { var m = MAP(); if (m) m.removeLayer(markers[id]); } catch (_) {}
      delete markers[id];
    }
  }
  function stopGps() {
    if (watchId != null && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
    }
    watchId = null;
  }
  function suppressTrip(tripId) {
    tripId = String(tripId || '');
    if (!tripId || suppressed[tripId]) return;
    suppressed[tripId] = true;
    Object.keys(markers).forEach(function (id) {
      if (String(markers[id]._rrTripId || '') === tripId) removeMarker(id);
    });
    if (currentShare && currentShare.tripId === tripId) {
      stopGps();
      currentShare.active = false;
      if (currentShare.ref) currentShare.ref.update({ active: false, updatedAt: Date.now() }).catch(function () {});
      currentShare = null;
    }
  }

  // app-main fetches the MBTA vehicle endpoint on each native-feed poll. Count three
  // distinct, valid positions per trip; once native tracking is established, hide the fallback.
  if (typeof nativeFetch === 'function') {
    window.fetch = function () {
      var args = arguments;
      return nativeFetch.apply(this, args).then(function (response) {
        var url = '';
        try { url = String(args[0] && args[0].url ? args[0].url : args[0]); } catch (_) {}
        if (/api-v3\.mbta\.com\/vehicles(?:\?|$)/i.test(url)) {
          try {
            response.clone().json().then(function (payload) {
              (payload && Array.isArray(payload.data) ? payload.data : []).forEach(function (vehicle) {
                var a = vehicle && vehicle.attributes || {}, rel = vehicle && vehicle.relationships || {};
                var trip = rel.trip && rel.trip.data && rel.trip.data.id;
                var lat = Number(a.latitude), lon = Number(a.longitude);
                if (!trip || !isFinite(lat) || !isFinite(lon) || !lat || !lon || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
                var key = String(trip), pos = lat.toFixed(5) + ',' + lon.toFixed(5);
                var state = feedPositions[key] || (feedPositions[key] = { last: '', points: Object.create(null), count: 0 });
                if (state.last !== pos && !state.points[pos]) {
                  state.last = pos; state.points[pos] = true; state.count++;
                  if (state.count >= 3) suppressTrip(key);
                }
              });
            }).catch(function () {});
          } catch (_) {}
        }
        return response;
      });
    };
  }

  function paint(doc) {
    var d = doc.data() || {}, id = doc.id, map = MAP();
    if (!map || !window.L || d.active !== true || suppressed[String(d.tripId)] ||
        Number(d.expiresAt) <= Date.now() || !isFinite(Number(d.lat)) || !isFinite(Number(d.lon))) {
      removeMarker(id); return;
    }
    var icon = L.icon({
      iconUrl: iconUrl(d.icon), iconSize: [44, 44], iconAnchor: [22, 22],
      popupAnchor: [0, -22], className: 'train-icon'
    });
    var marker = markers[id];
    if (!marker) {
      marker = L.marker([Number(d.lat), Number(d.lon)], { icon: icon, zIndexOffset: 1900, keyboard: true });
      marker._rrTripId = String(d.tripId || '');
      marker.on('click', function () {
        var target = marker.getLatLng();
        map.flyTo(target, Math.max(map.getZoom(), 14), { animate: true });
        setTimeout(function () {
          if (typeof window.openTrainSchedule === 'function') {
            window.openTrainSchedule(d.tripId, d.routeName, d.destination, d.serviceDate || '');
          }
        }, 900);
      });
      markers[id] = marker;
      marker.addTo(map);
    } else {
      marker._rrTripId = String(d.tripId || '');
      marker.setLatLng([Number(d.lat), Number(d.lon)]);
      marker.setIcon(icon);
    }
  }
  function listenShares() {
    var store = getDb();
    if (!store) return;
    var cutoff = firebase.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
    store.collection('adminMbtaTrainShares').where('active', '==', true).where('expireAt', '>', cutoff)
      .onSnapshot(function (snap) {
        var seen = Object.create(null);
        snap.forEach(function (doc) { seen[doc.id] = true; paint(doc); });
        Object.keys(markers).forEach(function (id) { if (!seen[id]) removeMarker(id); });
      }, function (err) { console.warn('[admin-mbta-share] listener failed', err); });
  }

  function addShareControls(args) {
    var popup = document.querySelector('.leaflet-popup .train-popup');
    if (!popup || !popup.querySelector('.status-scheduled')) return;
    var footer = popup.querySelector('.train-popup-footer');
    if (!footer || footer.querySelector('.rr-admin-mbta-share')) return;
    var source = document.getElementById('trip-log-live-icon');
    if (!source) return;
    var select = source.cloneNode(true);
    select.removeAttribute('id');
    select.removeAttribute('name');
    select.className = 'rr-admin-mbta-icon-select';
    select.setAttribute('aria-label', 'Train icon');
    select.style.maxWidth = '145px';
    select.style.marginRight = '6px';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'popup-action-btn rr-admin-mbta-share';
    button.textContent = 'Share Location';
    button.addEventListener('click', function () {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Getting GPS…';
      startShare(args, iconUrl(select.value), button);
    });
    footer.appendChild(select);
    footer.appendChild(button);
  }

  function startShare(args, icon, button) {
    var store = getDb(), user = auth && auth.currentUser;
    if (!store || !user || !navigator.geolocation) {
      button.disabled = false; button.textContent = 'Share Location';
      alert('Sign in and allow location access to share this train.');
      return;
    }
    var tripId = String(args.tripId || '');
    if (!tripId) { button.disabled = false; button.textContent = 'Share Location'; return; }
    var code = randomCode(), started = Date.now(), expires = started + 5 * 60 * 60 * 1000;
    var ref = store.collection('adminMbtaTrainShares').doc(code);
    var saved = false, lastWrite = 0, timer = null;
    function fail(message) {
      stopGps();
      button.disabled = false; button.textContent = 'Share Location';
      if (timer) clearTimeout(timer);
      alert(message);
    }
    function accept(pos) {
      if (!pos || !pos.coords) return;
      var c = pos.coords, lat = Number(c.latitude), lon = Number(c.longitude);
      var accuracy = Number(c.accuracy), age = Date.now() - Number(pos.timestamp || 0);
      if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 ||
          !isFinite(accuracy) || accuracy <= 0 || accuracy > 1500 || age < -5000 || age > 60000) return;
      var now = Date.now();
      if (saved && now - lastWrite < 10000) return;
      lastWrite = now;
      var payload = {
        uid: user.uid, tripId: tripId,
        trainNumber: String(args.trainNumber || tripId).slice(0, 32),
        routeName: String(args.routeName || 'MBTA').slice(0, 100),
        destination: String(args.destination || '').slice(0, 100),
        serviceDate: /^\d{4}-\d{2}-\d{2}$/.test(String(args.serviceDate || '')) ? String(args.serviceDate) : '',
        title: (String(args.routeName || 'MBTA') + ' ' + String(args.trainNumber || tripId)).slice(0, 120),
        icon: icon, active: true, lat: lat, lon: lon, startedAt: started,
        expiresAt: expires, expireAt: firebase.firestore.Timestamp.fromMillis(expires), updatedAt: now
      };
      ref.set(payload, { merge: true }).then(function () {
        saved = true;
        currentShare = { tripId: tripId, ref: ref, active: true };
        button.textContent = 'Sharing Location';
        button.disabled = true;
      }).catch(function (err) {
        console.warn('[admin-mbta-share] publish failed', err);
        fail('Could not publish this train location. Check your admin access and try again.');
      });
    }
    timer = setTimeout(function () {
      if (!saved) fail('Could not get an accurate current GPS location. Check location permission and try again.');
    }, 30000);
    try {
      watchId = navigator.geolocation.watchPosition(accept, function () {}, {
        enableHighAccuracy: true, maximumAge: 0, timeout: 15000
      });
    } catch (_) { fail('This browser could not start GPS tracking.'); }
  }

  function wrapSchedule() {
    if (typeof window.openTrainSchedule !== 'function' || window.openTrainSchedule.__rrAdminWrapped) return false;
    var original = window.openTrainSchedule;
    var wrapped = async function (tripId, routeName, destination, serviceDate) {
      var args = {
        tripId: String(tripId || ''), routeName: String(routeName || ''),
        destination: String(destination || ''), serviceDate: String(serviceDate || ''),
        trainNumber: String(tripId || '')
      };
      var result = await original.apply(this, arguments);
      isAdmin().then(function (admin) {
        if (!admin) return;
        setTimeout(function () { addShareControls(args); }, 250);
        setTimeout(function () { addShareControls(args); }, 1700);
      });
      return result;
    };
    wrapped.__rrAdminWrapped = true;
    window.openTrainSchedule = wrapped;
    return true;
  }

  function boot() {
    if (!getDb() || !window.L || !MAP()) return false;
    listenShares();
    wrapSchedule();
    return true;
  }
  var attempts = 0;
  var retry = setInterval(function () {
    attempts++;
    if (boot() || attempts > 60) clearInterval(retry);
  }, 500);
  if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(function () {
      adminPromise = null;
    });
  }
  window.addEventListener('beforeunload', stopGps);
})();
