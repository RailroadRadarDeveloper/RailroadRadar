(function () {
  if (window.__rrLiveBar) return;
  window.__rrLiveBar = true;
  var KEY = 'rrSpecialMoveShareV1';
  var CFG = {
    apiKey: 'AIzaSyBCXgIwkKHBrNfs4-0T0L9LQNb6GP-37Qs',
    authDomain: 'railroadradar-accounts.firebaseapp.com',
    projectId: 'railroadradar-accounts',
    storageBucket: 'railroadradar-accounts.firebasestorage.app',
    messagingSenderId: '896370923309',
    appId: '1:896370923309:web:594b0a20d3b1c6822e65a4'
  };
  function read() {
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
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function ensureBar() {
    var el = document.getElementById('rr-live-bar');
    if (el) return el;
    var css = document.getElementById('rr-live-bar-css');
    if (!css) {
      css = document.createElement('style');
      css.id = 'rr-live-bar-css';
      css.textContent = '#rr-live-bar{position:sticky;top:0;z-index:10030;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#b00020;color:#fff;padding:10px 16px;font:700 14px/1.3 sans-serif}#rr-live-bar[hidden]{display:none!important}#rr-live-bar button{background:#fff;color:#b00020;border:0;border-radius:999px;padding:6px 12px;font-weight:800;cursor:pointer}';
      document.head.appendChild(css);
    }
    el = document.createElement('div');
    el.id = 'rr-live-bar';
    el.hidden = true;
    el.innerHTML = '<span id="rr-live-bar-text">Sharing location on the live map</span><button type="button" id="rr-live-bar-stop">Stop sharing</button>';
    document.body.insertBefore(el, document.body.firstChild);
    el.querySelector('#rr-live-bar-stop').addEventListener('click', function () {
      try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
      el.hidden = true;
      if (typeof rrSpecialStopSharing === 'function') rrSpecialStopSharing();
      else stopRemote();
    });
    return el;
  }
  function show(o) {
    var el = ensureBar();
    var ago = o.updatedAt ? Math.max(0, Math.round((Date.now() - Number(o.updatedAt)) / 1000)) : 0;
    el.querySelector('#rr-live-bar-text').textContent = ago >= 10
      ? ('Sharing location on the live map \u00b7 updated ' + ago + 's ago')
      : 'Sharing location on the live map \u00b7 live';
    el.hidden = false;
  }
  function loadFirebase() {
    if (window.firebase && firebase.firestore) return Promise.resolve();
    function add(src) {
      return new Promise(function (ok, err) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = err;
        document.head.appendChild(s);
      });
    }
    return add('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
      .then(function () { return add('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'); })
      .then(function () { return add('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'); })
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(CFG);
      });
  }
  function publish(o, coords) {
    if (typeof rrSpecialWriteShare === 'function' && window.rrSpecialShareState) {
      rrSpecialWriteShare(coords, { force: false });
      return;
    }
    loadFirebase().then(function () {
      var user = firebase.auth().currentUser;
      if (!user || user.uid !== o.uid) return;
      firebase.firestore().collection('specialMoveShares').doc(user.uid).set({
        uid: user.uid,
        tripId: o.tripId,
        title: o.title || 'Live trip',
        active: true,
        lat: coords.latitude,
        lon: coords.longitude,
        startedAt: o.startedAt,
        expiresAt: o.expiresAt,
        updatedAt: Date.now()
      }, { merge: true });
    }).catch(function () {});
  }
  function stopRemote() {
    var o = read();
    loadFirebase().then(function () {
      var user = firebase.auth().currentUser;
      if (!user) return;
      firebase.firestore().collection('specialMoveShares').doc(user.uid).delete();
    }).catch(function () {});
  }
  function resume(o) {
    if (!navigator.geolocation || window.__rrLiveWatch) return;
    var start = function () {
      window.__rrLiveWatch = navigator.geolocation.watchPosition(function (pos) {
        o.updatedAt = Date.now();
        write(o);
        show(o);
        publish(o, pos.coords);
      }, function () {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    };
    if (!navigator.permissions) { start(); return; }
    navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
      if (p.state === 'granted') start();
    }).catch(start);
  }
  function boot() {
    var o = read();
    if (!o) return;
    show(o);
    setInterval(function () { var cur = read(); if (cur) show(cur); }, 10000);
    resume(o);
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
