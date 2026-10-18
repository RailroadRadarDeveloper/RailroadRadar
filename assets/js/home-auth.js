/* Home page sign-in: Firebase Auth only (no Firestore), popup sign-in so you stay on the home page.
   Signed-in visitors see their account in the header instead of the Sign in button; nothing redirects. */
(function () {
  var wrap = document.getElementById('header-auth');
  var btn = document.getElementById('btn-google-signin');
  var userBtn = document.getElementById('home-user');
  var signedIn = document.getElementById('home-signed-in');
  if (!wrap || !btn) return;
  function ready() { wrap.classList.add('is-ready'); }
  setTimeout(ready, 2500);

  function firstName(u) {
    var n = String((u && (u.displayName || u.email)) || 'Account').trim();
    return n.split(/[\s@]/)[0] || 'Account';
  }
  function render(u) {
    var on = !!u;
    btn.hidden = on;
    if (userBtn) {
      userBtn.hidden = !on;
      if (on) {
        var img = userBtn.querySelector('img');
        var name = userBtn.querySelector('.home-user-name');
        if (name) name.textContent = firstName(u);
        if (img) {
          if (u.photoURL) { img.src = u.photoURL; img.hidden = false; }
          else img.hidden = true;
        }
      }
    }
    if (signedIn) {
      signedIn.hidden = !on;
      var em = signedIn.querySelector('.home-signed-in-email');
      if (em) em.textContent = on ? (u.email || u.displayName || '') : '';
    }
    ready();
  }
  window.rrHomeAuthRender = render;

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
  if (out) out.addEventListener('click', function () { auth.signOut().catch(function () {}); });
  auth.onAuthStateChanged(function (u) { render(u); });
})();
