/* Home page sign-in: popup sign-in so you stay on the home page. Signed-in visitors see their account
   in the header the same way the live map shows it (photo, full name, verified badge), nothing redirects.
   Signed-out visitors never load Firestore. After sign-in the badge uses the same sources as the map:
   bootstrap admin emails, then the map's own cached verifiedReporters list, then a short local cache,
   and only if none of those answer, one read of the visitor's own verifiedReporters/{uid} document. */
(function () {
  var wrap = document.getElementById('header-auth');
  var btn = document.getElementById('btn-google-signin');
  var userBtn = document.getElementById('home-user');
  var signedIn = document.getElementById('home-signed-in');
  if (!wrap || !btn) return;
  function ready() { wrap.classList.add('is-ready'); }
  setTimeout(ready, 2500);

  var BOOTSTRAP_ADMIN_EMAILS = ['turokerr@gmail.com', 'railroadradar@gmail.com']; /* same list as the map */
  var TTL = 7 * 60 * 1000; /* the map keeps its verified list for 7 minutes */
  var FS_SRC = 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore-compat.js';
  var current = null;

  function normEmail(e) { return String(e || '').trim().toLowerCase(); }
  function isBootstrapAdmin(e) { e = normEmail(e); return !!e && BOOTSTRAP_ADMIN_EMAILS.indexOf(e) !== -1; }
  /* Map header label: full Google name, else the part of the email before @ */
  function label(u) {
    var full = String((u && u.displayName) || '').trim();
    return full || String((u && u.email) || '').split('@')[0] || 'Account';
  }
  function initialAvatar(u) {
    var i = String((u && (u.displayName || u.email)) || '?').trim().charAt(0).toUpperCase() || '?';
    i = i.replace(/[<>&"']/g, '?');
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><rect width="34" height="34" rx="17" fill="#2c3e6b"/><text x="17" y="22" text-anchor="middle" fill="#fff" font-size="14" font-family="Segoe UI,sans-serif" font-weight="700">' + i + '</text></svg>');
  }
  function paintBadge(kind) {
    var b = userBtn && userBtn.querySelector('.home-user-badge');
    if (!b) return;
    var t = kind === 'admin' ? 'Admin' : (kind === 'verified' ? 'Verified reporter' : '');
    b.hidden = !t;
    b.classList.toggle('is-verified', kind === 'verified');
    b.alt = t; b.title = t;
  }

  function render(u, badge) {
    var on = !!u;
    current = u || null;
    btn.hidden = on;
    if (userBtn) {
      userBtn.hidden = !on;
      if (on) {
        var img = userBtn.querySelector('.home-user-avatar');
        var name = userBtn.querySelector('.home-user-name');
        var text = label(u);
        if (name) name.textContent = text;
        userBtn.title = text;
        if (img) { img.src = u.photoURL || initialAvatar(u); img.alt = u.displayName || u.email || 'Account'; }
      }
    }
    if (signedIn) {
      signedIn.hidden = !on;
      var em = signedIn.querySelector('.home-signed-in-email');
      if (em) em.textContent = on ? (u.email || u.displayName || '') : '';
    }
    /* Cover headline becomes "Good Morning, <first name>" when signed in (no period); signed out keeps the headline */
    if (typeof window.rrHomeGreet === 'function') window.rrHomeGreet(on ? String(u.displayName || '') : null);
    /* "Sign in with Google to get started" is for signed-out visitors only */
    var note = document.getElementById('home-signup-note');
    if (note) note.hidden = on;
    if (!on) paintBadge(null);
    else if (badge !== undefined) paintBadge(badge);
    else lookupBadge(u);
    ready();
  }
  /* Test hook: rrHomeAuthRender(user, 'verified' | 'admin' | null) paints without any lookup; 'lookup' runs the real badge lookup */
  window.rrHomeAuthRender = function (u, badge) { render(u, badge === 'lookup' ? undefined : (badge === undefined ? null : badge)); };

  function cachedVerified(uid) {
    try {
      var o = JSON.parse(localStorage.getItem('rrCacheVerifiedReporters') || 'null');
      if (o && Array.isArray(o.rows) && Date.now() - Number(o.at || 0) < TTL) return o.rows.map(String).indexOf(String(uid)) !== -1;
    } catch (_) {}
    try {
      var h = JSON.parse(localStorage.getItem('rrHomeVerified') || 'null');
      if (h && h.uid === uid && Date.now() - Number(h.at || 0) < TTL) return !!h.v;
    } catch (_) {}
    return null;
  }
  var fsLoading = null;
  function loadFirestore() {
    if (firebase.firestore) return Promise.resolve();
    if (fsLoading) return fsLoading;
    fsLoading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = FS_SRC; s.async = true;
      s.onload = function () { firebase.firestore ? res() : rej(new Error('no firestore')); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return fsLoading;
  }
  function lookupBadge(u) {
    paintBadge(null);
    if (isBootstrapAdmin(u.email)) { paintBadge('admin'); return; }
    var c = cachedVerified(u.uid);
    if (c !== null) { paintBadge(c ? 'verified' : null); return; }
    loadFirestore().then(function () {
      return firebase.firestore().collection('verifiedReporters').doc(String(u.uid)).get();
    }).then(function (snap) {
      var v = !!(snap && snap.exists);
      try { localStorage.setItem('rrHomeVerified', JSON.stringify({ uid: u.uid, v: v, at: Date.now() })); } catch (_) {}
      if (current && current.uid === u.uid) paintBadge(v ? 'verified' : null);
    }).catch(function () { /* no badge if the lookup fails */ });
  }

  if (typeof firebase === 'undefined' || !firebase.auth) { ready(); return; } /* the button still links to /mytrips/ */
  var cfg = {
    apiKey: 'AIzaSyBCXgIwkKHBrNfs4-0T0L9LQNb6GP-37Qs',
    authDomain: 'railroadradar-accounts.firebaseapp.com',
    projectId: 'railroadradar-accounts',
    storageBucket: 'railroadradar-accounts.firebasestorage.app',
    messagingSenderId: '896370923309',
    appId: '1:896370923309:web:594b0a20d3b1c6822e65a4'
  };
  var auth;
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    auth = firebase.auth();
  } catch (_) { ready(); return; }

  var busy = false;
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (err) {
      var code = err && err.code;
      if (code === 'auth/popup-blocked') location.href = '/mytrips/'; /* MyTrips has its own sign-in */
    }).then(function () { busy = false; }, function () { busy = false; });
  });
  if (userBtn) {
    userBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = document.getElementById('btn-header-tools');
      if (menu) menu.click();
    });
  }
  var out = document.getElementById('home-signout');
  if (out) out.addEventListener('click', function () {
    try { localStorage.removeItem('rrHomeVerified'); } catch (_) {}
    auth.signOut().catch(function () {});
  });
  auth.onAuthStateChanged(function (u) { render(u); });
})();
