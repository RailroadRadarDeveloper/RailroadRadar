
    (function () {
      var KEY = 'rr_cookie_prefs';
      var LEGACY = 'rr_cookie_consent';
      var bar = document.getElementById('rr-cookie-bar');
      var modal = document.getElementById('rr-cookie-modal');
      if (!bar || !modal) return;

      function readPrefs() {
        try {
          var raw = localStorage.getItem(KEY);
          if (raw) {
            var o = JSON.parse(raw);
            if (o && typeof o === 'object') return o;
          }
        } catch (_) {}
        try {
          var leg = localStorage.getItem(LEGACY);
          if (leg === 'accepted') return { decided: true, clarity: true, preferences: true };
          if (leg === 'declined') return { decided: true, clarity: false, preferences: true };
        } catch (_) {}
        return null;
      }

      function writePrefs(prefs) {
        try {
          localStorage.setItem(KEY, JSON.stringify(prefs));
          localStorage.setItem(LEGACY, prefs.clarity ? 'accepted' : 'declined');
        } catch (_) {}
      }

      function applyClarity(on) {
        if (on && typeof window.__rrLoadClarity === 'function') window.__rrLoadClarity();
        if (on && typeof window.__rrLoadBetterStack === 'function') window.__rrLoadBetterStack();
        if (on && typeof window.__rrLoadGoogleAnalytics === 'function') window.__rrLoadGoogleAnalytics();
        if (!on && typeof window.__rrStopClarity === 'function') window.__rrStopClarity();
        if (!on && typeof window.__rrStopGoogleAnalytics === 'function') window.__rrStopGoogleAnalytics();
      }

      function openModal() {
        var prefs = readPrefs() || { clarity: false };
        var c = document.getElementById('rr-cookie-clarity');
        if (c) c.checked = !!prefs.clarity;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
      }

      function closeModal() {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
      }

      function saveFromUi(clarity) {
        var prefs = {
          decided: true,
          clarity: !!clarity,
          preferences: true,
          decidedAt: new Date().toISOString()
        };
        writePrefs(prefs);
        bar.hidden = true;
        closeModal();
        applyClarity(prefs.clarity);
        try {
          if (typeof window.persistCookieConsentToAccount === 'function') {
            window.persistCookieConsentToAccount(prefs);
          } else {
            window.__rrCookiePrefsPending = prefs;
          }
        } catch (_) {}
      }

      var existing = readPrefs();
      if (existing && existing.decided) {
        applyClarity(!!existing.clarity);
      } else {
        bar.hidden = false;
      }

      document.getElementById('rr-cookie-accept').addEventListener('click', function () { saveFromUi(true); });
      document.getElementById('rr-cookie-decline').addEventListener('click', function () { saveFromUi(false); });
      document.getElementById('rr-cookie-customize').addEventListener('click', openModal);
      document.getElementById('rr-cookie-save').addEventListener('click', function () {
        saveFromUi(document.getElementById('rr-cookie-clarity').checked);
      });
      document.getElementById('rr-cookie-cancel').addEventListener('click', closeModal);
      document.getElementById('rr-cookie-modal-backdrop').addEventListener('click', closeModal);
      document.getElementById('footer-cookie-settings').addEventListener('click', openModal);

      /* Trip mytrips clarity cookies */
      window.openRrCookieSettings = openModal;
      var mytripsCookieBtn = document.getElementById('rr-cookie-settings-mytrips');
      if (mytripsCookieBtn) {
        mytripsCookieBtn.addEventListener('click', function () {
          openModal();
        });
      }
      var cookieMenuBtn = document.getElementById('header-menu-cookie-settings');
      if (cookieMenuBtn) {
        cookieMenuBtn.addEventListener('click', function () {
          try { if (typeof closeAccountMenu === 'function') closeAccountMenu(); } catch (_) {}
          openModal();
        });
      }
    })();
  