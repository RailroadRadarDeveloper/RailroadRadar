/* Microsoft Clarity for every page. It starts only after the visitor allows Analytics in the cookie banner. */
(function () {
  window.__rrLoadClarity = function () {
    if (!window.__rrClarityLoaded) {
      window.__rrClarityLoaded = true;
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "yie7bk3bns");
    }
    /* Without a consent signal Clarity runs visits from the EEA, UK and Switzerland without cookies.
       The banner asks about analytics only, so ad storage stays denied. */
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
  };

  /* Called when the visitor turns Analytics off: Clarity clears its cookies and stops recording. */
  window.__rrStopClarity = function () {
    if (window.__rrClarityLoaded) window.clarity('consent', false);
  };

  try {
    var ok = localStorage.getItem('rr_cookie_consent') === 'accepted';
    var raw = localStorage.getItem('rr_cookie_prefs');
    if (raw) {
      var prefs = JSON.parse(raw);
      if (prefs && prefs.decided) ok = !!prefs.clarity;
    }
    if (ok) window.__rrLoadClarity();
  } catch (_) {}
})();
