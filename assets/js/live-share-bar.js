(function () {
  if (window.__rrLiveBar) return;
  window.__rrLiveBar = true;
  var KEY = 'rrSpecialMoveShareV1';
  var STOP = 'rrSpecialShareStopped';
  // watchPosition can go quiet while the phone sits still, so ask for a fix if none came in this long.
  var HEARTBEAT_MS = 15000;
  var CFG = {
    apiKey: 'AIzaSyBCXgIwkKHBrNfs4-0T0L9LQNb6GP-37Qs',
    authDomain: 'railroadradar-accounts.firebaseapp.com',
    projectId: 'railroadradar-accounts',
    storageBucket: 'railroadradar-accounts.firebasestorage.app',
    messagingSenderId: '896370923309',
    appId: '1:896370923309:web:594b0a20d3b1c6822e65a4'
  };
  function stopped() {
    try { return localStorage.getItem(STOP) === '1'; } catch (e) { return false; }
  }
  function read() {
    if (stopped()) return null;
    try {
      var raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.expiresAt || Date.now() >= Number(o.expiresAt)) {
        localStorage.removeItem(KEY);
        return null;
      }
      return o;
    } catch (e) { return null; }
  }
  function write(o) {
    if (stopped()) return;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function clearWatch() {
    if (window.__rrLiveWatch && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(window.__rrLiveWatch); } catch (e) {}
    }
    window.__rrLiveWatch = 0;
  }
  // Pages offset their content by this so the fixed bar does not cover it.
  function reserve() {
    var el = document.getElementById('rr-live-bar');
    document.documentElement.style.setProperty('--rr-live-bar-h', el && !el.hidden ? el.offsetHeight + 'px' : '0px');
  }
  function hide() {
    wakeRelease();
    var el = document.getElementById('rr-live-bar');
    if (el) el.hidden = true;
    reserve();
  }
  // Screen Wake Lock while the share is on, so the phone doesn't lock and pause location updates.
  // Browsers drop it whenever the page is hidden, so it is taken again once the page is visible.
  // Best effort only: unsupported browsers, low battery or a refusal never stop the share.
  // On the MyTrips page app-main.js holds the lock itself; this bar only shows its state there.
  var wake = null, wakePending = false, wakeRefused = false;
  function wakeSupported() {
    try { return !!(navigator.wakeLock && typeof navigator.wakeLock.request === 'function'); } catch (e) { return false; }
  }
  function pageOwnsWake() { return typeof window.rrSpecialWakeLockSync === 'function'; }
  function wakeHeld() { return pageOwnsWake() ? !!window.rrSpecialWakeLock : !!wake; }
  function wakeRelease() {
    var lock = wake;
    wake = null;
    if (lock) { try { Promise.resolve(lock.release()).catch(function () {}); } catch (e) {} }
  }
  function wakeAcquire() {
    if (pageOwnsWake() || !wakeSupported() || wake || wakePending || wakeRefused || document.visibilityState === 'hidden') return;
    wakePending = true;
    var req;
    try { req = Promise.resolve(navigator.wakeLock.request('screen')); } catch (e) { req = Promise.reject(e); }
    req.then(function (lock) {
      wakePending = false;
      // The share may have ended while the request was out.
      if (!read()) { try { Promise.resolve(lock && lock.release()).catch(function () {}); } catch (e) {} return; }
      wake = lock || null;
      try {
        lock.addEventListener('release', function () {
          if (wake === lock) wake = null;
          var cur = read();
          if (cur) show(cur);
        });
      } catch (e) {}
      var o = read();
      if (o) show(o);
    }, function () {
      wakePending = false;
      // Not again until the page is shown again, so a refusal can't turn into a retry loop.
      wakeRefused = true;
      var o = read();
      if (o) show(o);
    });
  }
  function endShare() {
    try {
      localStorage.setItem(STOP, '1');
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch (e) {}
    clearWatch();
    hide();
    if (typeof rrSpecialStopSharing === 'function') rrSpecialStopSharing();
    else stopRemote();
  }
  function leftLabel(o) {
    var left = Math.max(0, Number(o.expiresAt) - Date.now());
    var hrs = Math.floor(left / 3600000);
    var mins = Math.floor((left % 3600000) / 60000);
    return (hrs ? hrs + 'h ' : '') + mins + 'm left';
  }
  function ensureBar() {
    var el = document.getElementById('rr-live-bar');
    if (el && el.querySelector('#rr-live-bar-resume') && el.querySelector('#rr-live-bar-hint')) return el;
    if (el) el.remove();
    if (!document.getElementById('rr-live-bar-css')) {
      var css = document.createElement('style');
      css.id = 'rr-live-bar-css';
      css.textContent = '.rr-live-main{display:flex;flex-direction:column;min-width:0}#rr-live-bar-hint{font-weight:600;font-size:12px;line-height:1.25;opacity:.92}#rr-live-bar-hint:empty{display:none}#rr-live-bar{position:fixed;top:60px;left:0;right:0;z-index:10040;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#b00020;color:#fff;padding:8px 16px;font:700 14px/1.3 sans-serif}#rr-live-bar[hidden]{display:none!important}#rr-live-bar-text{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#rr-live-bar .rr-live-actions{display:flex;gap:8px}#rr-live-bar button{background:#fff;color:#b00020;border:0;border-radius:999px;padding:4px 12px;font-weight:800;white-space:nowrap;cursor:pointer}@media(max-width:600px){#rr-live-bar{gap:8px;padding:5px 10px;font-size:12px}#rr-live-bar .rr-live-actions{gap:6px}#rr-live-bar button{padding:3px 10px;font-size:12px}#rr-live-bar-hint{font-size:11px}}';
      document.head.appendChild(css);
    }
    el = document.createElement('div');
    el.id = 'rr-live-bar';
    el.hidden = true;
    el.innerHTML = '<span class="rr-live-main"><span id="rr-live-bar-text">Sharing paused</span><span id="rr-live-bar-hint"></span></span><span class="rr-live-actions"><button type="button" id="rr-live-bar-resume">Resume sharing</button><button type="button" id="rr-live-bar-stop">Stop sharing</button></span>';
    var header = document.querySelector('.header');
    if (header && header.parentNode) header.parentNode.insertBefore(el, header.nextSibling);
    else document.body.appendChild(el);
    el.querySelector('#rr-live-bar-resume').addEventListener('click', function () {
      var o = read();
      if (window.rrSpecialShareState && typeof rrSpecialResumeSharing === 'function') rrSpecialResumeSharing(true);
      else if (o) startWatch(o);
    });
    el.querySelector('#rr-live-bar-stop').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      endShare();
    });
    return el;
  }
  function show(o) {
    if (stopped() || !o) { hide(); return; }
    var el = ensureBar();
    var resume = el.querySelector('#rr-live-bar-resume');
    // On the map the page runs its own watch and tracks the last write; elsewhere this script does.
    var st = window.rrSpecialShareState;
    var live = st ? (!st.resumeNeeded && !!window.rrSpecialShareWatching()) : !!window.__rrLiveWatch;
    if (resume) resume.hidden = live;
    var last = st ? st.lastWriteAt : o.updatedAt;
    var ago = last ? Math.max(0, Math.round((Date.now() - Number(last)) / 1000)) : 0;
    el.querySelector('#rr-live-bar-text').textContent = live
      ? ('Sharing live' + (ago >= 10 ? (' \u00b7 updated ' + ago + 's ago') : '') + ' \u00b7 ' + leftLabel(o))
      : ('Sharing paused \u00b7 ' + leftLabel(o));
    if (live) wakeAcquire();
    var hint = el.querySelector('#rr-live-bar-hint');
    var hintText = !live ? '' : (wakeHeld() ? 'Screen stays on while you\u2019re live.'
      : ((wakePending && !pageOwnsWake()) ? '' : 'Keep this page open so your location keeps updating.'));
    if (hint && hint.textContent !== hintText) hint.textContent = hintText;
    el.hidden = false;
    reserve();
  }
  function loadFirebase() {
    if (window.firebase && firebase.firestore) return Promise.resolve();
    function add(src) {
      return new Promise(function (ok, err) {
        var s = document.createElement('script');
        s.src = src; s.onload = ok; s.onerror = err;
        document.head.appendChild(s);
      });
    }
    return add('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js')
      .then(function () { return add('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth-compat.js'); })
      .then(function () { return add('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore-compat.js'); })
      .then(function () { if (!firebase.apps.length) firebase.initializeApp(CFG); });
  }
  // Every write is a read for each viewer, so write at most every WRITE_MIN_MS once the position moved
  // WRITE_MOVE_M, or every WRITE_HEARTBEAT_MS while still (viewers drop a share after 30 minutes).
  var WRITE_MIN_MS = 5000;
  var WRITE_MOVE_M = 20;
  var WRITE_HEARTBEAT_MS = 60000;
  var lastSentAt = 0, lastSentLat = null, lastSentLon = null;
  function metersBetween(lat1, lon1, lat2, lon2) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function writeDue(coords) {
    var since = Date.now() - lastSentAt;
    if (since >= WRITE_HEARTBEAT_MS) return true;
    return since >= WRITE_MIN_MS && metersBetween(lastSentLat, lastSentLon, coords.latitude, coords.longitude) >= WRITE_MOVE_M;
  }
  function publish(o, coords) {
    if (stopped()) return;
    if (typeof rrSpecialWriteShare === 'function' && window.rrSpecialShareState) {
      rrSpecialWriteShare(coords, { force: false });
      return;
    }
    if (!writeDue(coords)) return;
    loadFirebase().then(function () {
      if (stopped()) return;
      var user = firebase.auth().currentUser;
      if (!user || user.uid !== o.uid) return;
      lastSentAt = Date.now();
      lastSentLat = coords.latitude;
      lastSentLon = coords.longitude;
      firebase.firestore().collection('specialMoveShares').doc(user.uid).set({
        uid: user.uid, tripId: o.tripId, title: o.title || 'Live trip', active: true,
        lat: coords.latitude, lon: coords.longitude, heading: coords.heading, speed: coords.speed, startedAt: o.startedAt, expiresAt: o.expiresAt, expireAt: firebase.firestore.Timestamp.fromMillis(Number(o.expiresAt)), updatedAt: Date.now()
      }, { merge: true });
    }).catch(function () {});
  }
  function stopRemote() {
    loadFirebase().then(function () {
      var user = firebase.auth().currentUser;
      if (!user) return;
      firebase.firestore().collection('specialMoveShares').doc(user.uid).delete();
    }).catch(function () {});
  }
  function startWatch(o) {
    if (stopped() || !o || !navigator.geolocation || window.__rrLiveWatch) return;
    window.__rrLiveWatch = navigator.geolocation.watchPosition(function (pos) {
      if (stopped()) { clearWatch(); return; }
      o.updatedAt = Date.now();
      write(o);
      show(o);
      publish(o, pos.coords);
    }, function (err) {
      if (err && err.code === 1) {
        window.__rrLiveWatch = 0;
        show(o);
      }
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    show(o);
  }
  var asking = false;
  function heartbeat(o) {
    if (asking) return;
    asking = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      asking = false;
      if (stopped()) return;
      o.updatedAt = Date.now();
      write(o);
      show(o);
      publish(o, pos.coords);
    }, function () { asking = false; }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 });
  }
  function tick() {
    var cur = read();
    if (!cur) { hide(); return; }
    show(cur);
    if (window.__rrLiveWatch && Date.now() - Number(cur.updatedAt || 0) >= HEARTBEAT_MS) heartbeat(cur);
  }
  function boot() {
    var existing = null;
    try { existing = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (existing && existing.expiresAt && Date.now() < Number(existing.expiresAt)) {
      try { localStorage.removeItem(STOP); } catch (e) {}
    }
    if (stopped()) { hide(); return; }
    var o = read();
    if (!o) return;
    show(o);
    startWatch(o);
  }
  var oldPersist = window.rrSpecialPersistLocal;
  window.rrSpecialPersistLocal = function (state) {
    if (typeof oldPersist === 'function') { try { oldPersist(state); } catch (e) {} }
    if (!state || stopped()) {
      try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
      hide();
      return;
    }
    try { localStorage.removeItem(STOP); } catch (e) {}
    write({ uid: state.uid, tripId: state.tripId, title: state.title, startedAt: state.startedAt, expiresAt: state.expiresAt, updatedAt: Date.now() });
    show(read());
  };
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('resize', reserve);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    wakeRefused = false;
    var o = read();
    if (o) show(o);
  });
  setInterval(tick, 2000);
})();
