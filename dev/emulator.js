// Injected by dev/serve.py. Points every Firebase app on the page at the local emulators and adds window.rrDev.
(function () {
  var HOST = location.hostname;
  var PORTS = { auth: 9099, firestore: 8080, storage: 9199 };

  function connect(name, svc) {
    if (name === 'auth') svc.useEmulator('http://' + HOST + ':' + PORTS.auth, { disableWarnings: true });
    else svc.useEmulator(HOST, PORTS[name]);
  }

  // Each service has to be connected on first use, before it makes any request.
  function wrapApp(app) {
    if (app.__rrDev) return app;
    app.__rrDev = true;
    Object.keys(PORTS).forEach(function (name) {
      var orig = app[name];
      if (typeof orig !== 'function') return;
      var svc = null;
      app[name] = function () {
        if (!svc) { svc = orig.apply(app, arguments); connect(name, svc); }
        return svc;
      };
    });
    return app;
  }

  var fb;
  // The compat SDK assigns window.firebase when it loads, so catch it there and wrap initializeApp.
  Object.defineProperty(window, 'firebase', {
    configurable: true,
    get: function () { return fb; },
    set: function (v) {
      fb = v;
      if (!v || v.__rrDev) return;
      v.__rrDev = true;
      var init = v.initializeApp;
      v.initializeApp = function () { return wrapApp(init.apply(this, arguments)); };
    }
  });

  // These Worker routes act on real subscribers and the real Discord channel.
  var realFetch = window.fetch;
  window.fetch = function (input) {
    var url = String((input && input.url) || input);
    if (/\/api\/(push\/(subscribe|unsubscribe)|press\/notify)\b/.test(url)) {
      console.info('[rrDev] skipped', url);
      return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch.apply(this, arguments);
  };

  var usersP = null;
  function users() {
    if (!usersP) usersP = realFetch('/__dev/users.json').then(function (r) { return r.json(); });
    return usersP;
  }

  window.rrDev = {
    users: users,
    // Signs in as a test user from dev/users.json, the same way a Google sign-in would.
    signIn: function (id) {
      return users().then(function (all) {
        var u = all[id];
        if (!u) throw new Error('No test user "' + id + '". Try one of: ' + Object.keys(all).join(', '));
        var token = JSON.stringify({ sub: id, email: u.email, email_verified: true, name: u.name });
        var cred = fb.auth.GoogleAuthProvider.credential(token);
        return fb.auth().signInWithCredential(cred);
      }).then(function (res) { return { uid: res.user.uid, email: res.user.email }; });
    },
    signOut: function () { return fb.auth().signOut(); },
    whoami: function () {
      var u = fb && fb.apps.length && fb.auth().currentUser;
      return u ? { uid: u.uid, email: u.email } : null;
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var tag = document.createElement('div');
    tag.textContent = 'Local test database';
    tag.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:3px 8px;border-radius:4px;' +
      'background:#b00020;color:#fff;font:600 12px/1.4 sans-serif;pointer-events:none;opacity:.85';
    document.body.appendChild(tag);
  });
})();
