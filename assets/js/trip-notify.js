/* MyTrips boarding-track alerts (MBTA South/North Station and any stop with a live track).
   Runs while a RailroadRadar page or the installed web app is open: polls live predictions
   for the user's upcoming trip and shows one notification per trip when its track is assigned.
   Offered only on desktop browsers and installed Home Screen web apps. */
(function () {
  'use strict';
  var API = 'https://railroadradar-proxy.railroadradar.workers.dev';
  var K_ON = 'rr_trip_notify_on';
  var K_Q = 'rr_trip_notify_q';
  var K_FIRED = 'rr_trip_notify_fired';
  var POLL_MS = 45000;
  var BEFORE_MS = 35 * 60 * 1000;   // start watching 35 min before departure
  var AFTER_MS = 20 * 60 * 1000;    // keep watching up to 20 min after (late trains)
  var timer = null;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (_) {}
    return null;
  }
  function readJson(k, d) { try { var v = JSON.parse(ls(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }

  function isStandalone() {
    try { if (navigator.standalone === true) return true; } catch (_) {}
    try {
      if (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches)) return true;
    } catch (_) {}
    return false;
  }
  function isMobileDevice() {
    try { if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean' && navigator.userAgentData.mobile) return true; } catch (_) {}
    var ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true; // iPadOS
    return false;
  }
  function supported() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
    return isStandalone() || !isMobileDevice();
  }
  function enabled() { return ls(K_ON) === '1' && supported() && Notification.permission === 'granted'; }

  function fired() { return readJson(K_FIRED, {}); }
  function markFired(key) {
    var f = fired(); var now = Date.now();
    Object.keys(f).forEach(function (k) { if (now - f[k] > 2 * 86400000) delete f[k]; });
    f[key] = now; ls(K_FIRED, JSON.stringify(f));
  }

  function fmtTime(ms) {
    try { return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }); }
    catch (_) { return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  }
  function trackOf(stop) {
    var a = (stop && stop.attributes) || {};
    if (a.platform_code != null && String(a.platform_code).trim()) return String(a.platform_code).trim();
    var m = String(a.description || a.platform_name || '').match(/track\s+(\d+[A-Za-z]?)/i);
    return m ? m[1] : null;
  }

  async function show(item, track, headsign) {
    var dest = headsign || item.destName || '';
    var line = item.lineName || 'Train';
    var body = line + ' ' + item.train + ' (' + fmtTime(item.dep) + ')' + (dest ? ' to ' + dest : '') + ' is boarding on track ' + track;
    var title = 'Track ' + track + ' · ' + line + ' ' + item.train;
    var opts = { body: body, tag: 'rr-trip-' + item.key, icon: '/assets/icons/icon-192.png', timestamp: Date.now(), data: { url: '/mytrips/' } };
    if (!isMobileDevice()) opts.requireInteraction = true; // desktop: stay until dismissed
    try {
      var reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) { await navigator.serviceWorker.register('/sw.js'); reg = await navigator.serviceWorker.ready; }
      if (reg && reg.showNotification) {
        try { await reg.showNotification(title, opts); }
        catch (_) { await reg.showNotification(title, { body: body, tag: opts.tag }); }
        return true;
      }
    } catch (_) {}
    try { new Notification(title, opts); return true; } catch (_) {}
    return false;
  }

  async function checkItem(item, now) {
    var url = API + '/api/mbta/predictions?filter[stop]=' + encodeURIComponent(item.originId) +
      '&filter[route_type]=2&include=stop,trip&page[limit]=100';
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    var j = await res.json();
    var inc = {};
    (j.included || []).forEach(function (x) { inc[x.type + ':' + x.id] = x; });
    var rows = j.data || [];
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      if (!p.attributes || !p.attributes.departure_time) continue;
      var tr = p.relationships && p.relationships.trip && p.relationships.trip.data;
      var trip = tr ? inc['trip:' + tr.id] : null;
      var name = trip && trip.attributes ? String(trip.attributes.name || '') : '';
      if (!name || name !== String(item.train)) continue; // exact train number, no substring matches
      var depMs = Date.parse(p.attributes.departure_time);
      if (Math.abs(depMs - item.dep) > 3 * 3600000) continue; // same day's run only
      var st = p.relationships.stop && p.relationships.stop.data;
      var track = trackOf(st ? inc['stop:' + st.id] : null);
      if (!track) return; // not assigned yet; try again next poll
      if (fired()[item.key]) return;
      markFired(item.key);
      await show(item, track, trip.attributes.headsign);
      return;
    }
  }

  async function tick() {
    if (!enabled()) return;
    if (document.visibilityState === 'hidden' && !isStandalone() && isMobileDevice()) return;
    var now = Date.now();
    var q = readJson(K_Q, []);
    var due = q.filter(function (it) {
      return it && it.railroad === 'mbta' && it.originId && it.train && !fired()[it.key] &&
        it.dep - now <= BEFORE_MS && now - it.dep <= AFTER_MS;
    });
    for (var i = 0; i < due.length && i < 3; i++) {
      try { await checkItem(due[i], now); } catch (e) { console.warn('[trip-notify]', e); }
    }
  }
  function start() {
    if (timer) return;
    timer = setInterval(tick, POLL_MS);
    setTimeout(tick, 1500);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Items: [{ key, railroad, lineName, train, dep (ms), originId (place-*), destName }]
  function setTrips(items) {
    var now = Date.now();
    var clean = (items || []).filter(function (it) {
      return it && it.key && it.railroad === 'mbta' && it.train && it.originId && isFinite(it.dep) && it.dep > now - AFTER_MS && it.dep < now + 7 * 86400000;
    }).slice(0, 20);
    ls(K_Q, JSON.stringify(clean));
  }
  function clearTrips() { ls(K_Q, null); }

  async function setEnabled(on) {
    if (!on) { ls(K_ON, '0'); stop(); return { on: false }; }
    if (!supported()) return { on: false, reason: 'unsupported' };
    var perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (_) {} }
    if (perm !== 'granted') { ls(K_ON, '0'); return { on: false, reason: perm === 'denied' ? 'denied' : 'dismissed' }; }
    try { if (!(await navigator.serviceWorker.getRegistration('/'))) await navigator.serviceWorker.register('/sw.js'); } catch (_) {}
    ls(K_ON, '1'); start();
    return { on: true };
  }

  window.rrTripNotify = {
    supported: supported, enabled: enabled, setEnabled: setEnabled,
    setTrips: setTrips, clearTrips: clearTrips, tick: tick,
    wantsOn: function () { return ls(K_ON) === '1'; }
  };
  function wireUi() {
    var row = document.getElementById('trip-notify-row');
    var box = document.getElementById('trip-notify-toggle');
    var st = document.getElementById('trip-notify-status');
    if (!row || !box || box.getAttribute('data-wired') === '1') return;
    box.setAttribute('data-wired', '1');
    if (!supported()) { row.hidden = true; return; }
    row.hidden = false;
    function say(t) { if (st) st.textContent = t || ''; }
    box.checked = enabled();
    if (ls(K_ON) === '1' && Notification.permission === 'denied') say('Notifications are blocked for this site in your browser settings.');
    box.addEventListener('change', async function () {
      box.disabled = true;
      var r = await setEnabled(box.checked);
      box.checked = !!r.on;
      box.disabled = false;
      if (r.on) say('On. You\'ll get an alert when your MBTA train is boarding on its track, while RailroadRadar is open.');
      else if (r.reason === 'denied') say('Notifications are blocked for this site. Allow them in your browser settings, then try again.');
      else if (r.reason === 'dismissed') say('Notifications were not allowed.');
      else say('');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireUi); else wireUi();
  window.rrTripNotify.wireUi = wireUi;
  if (enabled()) start();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && enabled()) tick(); });
})();
