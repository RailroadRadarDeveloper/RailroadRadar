/* Google Analytics 4 for every page. Like Clarity, it starts only after the visitor allows Analytics in the cookie banner.
   Google Consent Mode v2: advertising storage, ad user data and ad personalization are always denied;
   analytics storage is denied until the visitor agrees. Nothing is requested from Google before that. */
(function () {
  var GA_ID = 'G-Y4CEFKX1WZ';
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });

  window.__rrLoadGoogleAnalytics = function () {
    window['ga-disable-' + GA_ID] = false;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    if (window.__rrGaLoaded) return;
    window.__rrGaLoaded = true;
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    var y = document.getElementsByTagName('script')[0];
    if (y && y.parentNode) y.parentNode.insertBefore(s, y);
    else (document.head || document.documentElement).appendChild(s);
  };

  /* Called when the visitor turns Analytics off: Google Analytics stops sending and its cookies on our site are cleared. */
  window.__rrStopGoogleAnalytics = function () {
    window['ga-disable-' + GA_ID] = true;
    if (window.__rrGaLoaded) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    try {
      var host = location.hostname;
      var parts = host.split('.');
      var domains = ['', host, '.' + host];
      if (parts.length > 1) domains.push('.' + parts.slice(-2).join('.'));
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (name !== '_ga' && name.indexOf('_ga_') !== 0) return;
        domains.forEach(function (d) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
        });
      });
    } catch (_) {}
  };

  try {
    var ok = localStorage.getItem('rr_cookie_consent') === 'accepted';
    var raw = localStorage.getItem('rr_cookie_prefs');
    if (raw) {
      var prefs = JSON.parse(raw);
      if (prefs && prefs.decided) ok = !!prefs.clarity;
    }
    if (ok) window.__rrLoadGoogleAnalytics();
  } catch (_) {}
})();
