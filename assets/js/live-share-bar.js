(function () {
  if (window.__rrLiveBar) return;
  window.__rrLiveBar = true;
  var KEY = 'rrSpecialMoveShareV1';
  var STOP = 'rrSpecialShareStopped';
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
  function hide() {
    var el = document.getElementById('rr-live-bar');
    if (el) el.hidden = true;
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
    if (el && el.querySelector('#rr-live-bar-resume')) return el;
    if (el) el.remove();
    if (!document.getElementById('rr-live-bar-css')) {
      var css = document.createElement('style');
      css.id = 'rr-live-bar-css';
      css.textContent = '#rr-live-bar{position:fixed;top:60px;left:0;right:0;z-index:9000;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#b00020;color:#fff;padding:10px 16px;font:700 14px/1.3 sans-serif}#rr-live-bar[hidden]{display:none!important}#rr-live-bar .rr-live-actions{display:flex;gap:8px}#rr-live-bar button{background:#fff;color:#b00020;border:0;border-radius:999px;padding:6px 12px;font-weight:800;cursor:pointer}';
      document.head.appendChild(css);
    }
    el = document.createElement('div');
    el.id = 'rr-live-bar';
    el.hidden = true;
    el.innerHTML = '<span id="rr-live-bar-text">Sharing paused</span><span class="rr-live-actions"><button type="button" id="rr-live-bar-resume">Resume sharing</button><button type="button" id="rr-live-bar-stop">Stop sharing</button></span>';
    var header = document.querySelector('.header');
    if (header && header.parentNode) header.parentNode.insertBefore(el, header.nextSibling);
    else document.body.appendChild(el);
    el.querySelector('#rr-live-bar-resume').addEventListener('click', function () {
      var o = read();
      if (o) startWatch(o);
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
    var live = !!window.__rrLiveWatch;
    if (resume) resume.hidden = live;
    var ago = o.updatedAt ? Math.max(0, Math.round((Date.now() - Number(o.updatedAt)) / 1000)) : 0;
    el.querySelector('#rr-live-bar-text').innerHTML = live ? '' : '';
    el.querySelector('#rr-live-bar-text').textContent = live
      ? ('Sharing location on the live map \u00b7 ' + (ago >= 10 ? ('updated ' + ago + 's ago') : 'live') + ' \u00b7 ' + leftLabel(o))
      : ('Sharing paused \u00b7 ' + leftLabel(o));
    el.hidden = false;
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
    return add('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
      .then(function () { return add('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'); })
      .then(function () { return add('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'); })
      .then(function () { if (!firebase.apps.length) firebase.initializeApp(CFG); });
  }
  function publish(o, coords) {
    if (stopped()) return;
    if (typeof rrSpecialWriteShare === 'function' && window.rrSpecialShareState) {
      rrSpecialWriteShare(coords, { force: false });
      return;
    }
    loadFirebase().then(function () {
      if (stopped()) return;
      var user = firebase.auth().currentUser;
      if (!user || user.uid !== o.uid) return;
      firebase.firestore().collection('specialMoveShares').doc(user.uid).set({
        uid: user.uid, tripId: o.tripId, title: o.title || 'Live trip', active: true,
        lat: coords.latitude, lon: coords.longitude, heading: coords.heading, startedAt: o.startedAt, expiresAt: o.expiresAt, updatedAt: Date.now()
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
    }, function () {
      window.__rrLiveWatch = 0;
      show(o);
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    show(o);
  }
  function boot() {
    if (stopped()) { hide(); return; }
    var o = read();
    if (!o) return;
    show(o);
    setInterval(function () {
      if (stopped()) { hide(); return; }
      var cur = read();
      if (cur) show(cur); else hide();
    }, 10000);
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
      if (!stopped() && p.state === 'granted') startWatch(read());
    }).catch(function () {});
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
})();
