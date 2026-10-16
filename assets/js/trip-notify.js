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
  var K_POSTED = 'rr_trip_notify_posted';
  var FIRED_CACHE = 'rr-trip-fired';
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

  async function notify(title, body, tag, maxAgeMs) {
    var opts = { body: body, tag: tag, icon: '/assets/icons/icon-192.png', timestamp: Date.now(), data: { url: '/mytrips/' } };
    if (!isMobileDevice()) opts.requireInteraction = true; // desktop: stay until dismissed
    if (await pushAlreadyShown(tag, maxAgeMs)) return true;
    try {
      var reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) { await navigator.serviceWorker.register('/sw.js'); reg = await navigator.serviceWorker.ready; }
      if (reg && reg.showNotification) {
        try { await reg.showNotification(title, opts); }
        catch (_) { await reg.showNotification(title, { body: body, tag: tag }); }
        return true;
      }
    } catch (_) {}
    try { new Notification(title, opts); return true; } catch (_) {}
    return false;
  }

  // The service worker records each boarding push it shows (sw.js), so the page never repeats it.
  // maxAgeMs: for repeating alerts (delay updates), only a push shown that recently counts.
  async function pushAlreadyShown(tag, maxAgeMs) {
    try {
      if (window.caches) {
        var c = await caches.open(FIRED_CACHE);
        var hit = await c.match('/__rr-trip-fired/' + encodeURIComponent(tag));
        if (hit) {
          if (!maxAgeMs) return true;
          var at = Number(await hit.text()) || 0;
          if (Date.now() - at < maxAgeMs) return true;
        }
      }
    } catch (_) {}
    if (maxAgeMs) return false;
    try {
      var reg = await navigator.serviceWorker.getRegistration('/');
      if (reg && reg.getNotifications) {
        var open = await reg.getNotifications({ tag: tag });
        if (open && open.length) return true;
      }
    } catch (_) {}
    return false;
  }

  // ---- Background delivery: hand upcoming trips to the proxy worker, which sends a Web Push
  // from its cron when the track is assigned (works with the site closed).
  function b64uToBytes(s) {
    var pad = '='.repeat((4 - (s.length % 4)) % 4);
    var bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pushSubscription(create) {
    if (!('PushManager' in window)) return null;
    var reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) { await navigator.serviceWorker.register('/sw.js'); reg = await navigator.serviceWorker.ready; }
    if (!reg || !reg.pushManager) return null;
    var sub = await reg.pushManager.getSubscription();
    if (sub || !create) return sub;
    var v = await fetch(API + '/api/push/vapid');
    if (!v.ok) return null;
    var key = (await v.json() || {}).publicKey;
    if (!key) return null;
    // Only creates the browser subscription; special-unit alerts stay off unless chosen in their own settings.
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
  }
  async function syncServer(force) {
    try {
      var on = enabled();
      var sub = await pushSubscription(on);
      if (!sub) return;
      var f = fired();
      // Flags tell the worker which alerts this page already showed, so the push doesn't repeat them.
      var trips = on ? readJson(K_Q, []).filter(function (it) { return !f[it.key + '-cx'] && tripEnd(it) > Date.now(); }).map(function (it) {
        var t = { tripKey: it.key, trainNum: it.train, line: it.lineName || '', depTimeISO: new Date(it.dep).toISOString(), originStopId: it.originId, originName: it.originName || '', destination: it.destName || '' };
        if (it.arr) t.arrTimeISO = new Date(it.arr).toISOString();
        if (it.routeId) t.routeId = it.routeId;
        if (f[it.key]) t.boardingSent = f[it.key];
        if (f[it.key + '-30']) t.headsUpSent = f[it.key + '-30'];
        return t;
      }) : [];
      var sig = sub.endpoint + '|' + JSON.stringify(trips);
      if (!force && ls(K_POSTED) === sig) return; // unchanged: no KV write on the worker
      var json = sub.toJSON ? sub.toJSON() : sub;
      var res = await fetch(API + '/api/push/trips', {
        method: trips.length ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: { endpoint: json.endpoint, keys: json.keys }, trips: trips })
      });
      if (res.ok) ls(K_POSTED, sig);
    } catch (e) { console.warn('[trip-notify] server sync', e); }
  }

  function fmtDelay(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' hr' + (m ? ' ' + m + ' min' : '') : m + ' min';
  }
  var HEADSUP_MS = 30 * 60 * 1000;
  var LATE_MIN = 5;
  var LATE_EVERY_MS = 10 * 60 * 1000;
  var SKIP_EFFECTS = { ELEVATOR_CLOSURE: 1, ESCALATOR_CLOSURE: 1, ACCESS_ISSUE: 1, PARKING_CLOSURE: 1, PARKING_ISSUE: 1, BIKE_ISSUE: 1, FACILITY_ISSUE: 1, AMBER_ALERT: 1 };
  var K_ALERTS = 'rr_trip_notify_alerts';
  var K_TID = 'rr_trip_notify_tid';
  function tripEnd(it) { return Math.max(it.arr || 0, it.dep + 2 * 3600000); }
  function hashStr(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  // Active MBTA alerts for this train or its whole line (facility alerts skipped).
  async function tripAlerts(routeId, tripId) {
    if (!routeId) return [];
    try {
      var res = await fetch(API + '/api/mbta/alerts?filter[route]=' + encodeURIComponent(routeId) + '&filter[datetime]=NOW', { cache: 'no-store' });
      if (!res.ok) return [];
      var out = [];
      ((await res.json()).data || []).forEach(function (al) {
        var a = al.attributes || {};
        if (SKIP_EFFECTS[a.effect]) return;
        var hits = (a.informed_entity || []).some(function (e) { return e && ((tripId && e.trip === tripId) || (e.route === routeId && !e.trip && !e.stop)); });
        if (!hits) return;
        var h = String(a.header || a.short_header || '').replace(/\s+/g, ' ').trim();
        if (h) out.push({ id: String(al.id), header: h.length > 240 ? h.slice(0, 237) + '\u2026' : h, hash: hashStr(h) });
      });
      return out;
    } catch (_) { return []; }
  }
  // One notification per alert id; re-sent once if the alert's text changes.
  async function checkAlerts(item, now) {
    var tids = readJson(K_TID, {});
    var list = await tripAlerts(item.routeId || tids[item.key + '|r'] || '', tids[item.key] || '');
    if (!list.length) return;
    var all = readJson(K_ALERTS, {});
    var seen = all[item.key] || {};
    var line = item.lineName || 'Train';
    for (var i = 0; i < list.length; i++) {
      var al = list[i], prev = seen[al.id];
      if (prev && (prev.h === al.hash || prev.n >= 2)) continue;
      seen[al.id] = { h: al.hash, n: prev ? prev.n + 1 : 1, at: now };
      all[item.key] = seen; ls(K_ALERTS, JSON.stringify(all));
      var tag = 'rr-trip-' + item.key + '-alert-' + al.id;
      // A changed alert must show again, so only a push shown within the last 2 min counts as a duplicate.
      await notify(line + ' ' + item.train, al.header, tag, prev ? 120000 : 0);
    }
    Object.keys(all).forEach(function (k) {
      var s2 = all[k], newest = 0;
      Object.keys(s2).forEach(function (id) { newest = Math.max(newest, s2[id].at || 0); });
      if (now - newest > 2 * 86400000) delete all[k];
    });
    ls(K_ALERTS, JSON.stringify(all));
  }

  async function checkItem(item, now) {
    var f = fired();
    if (f[item.key + '-cx']) return;
    try { await checkAlerts(item, now); } catch (e) { console.warn('[trip-notify] alerts', e); }
    if (now - item.dep > AFTER_MS) return; // en route: only service alerts until arrival
    var url = API + '/api/mbta/predictions?filter[stop]=' + encodeURIComponent(item.originId) +
      '&filter[route_type]=2&include=stop,trip,schedule&page[limit]=150';
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    var j = await res.json();
    var inc = {};
    (j.included || []).forEach(function (x) { inc[x.type + ':' + x.id] = x; });
    var hit = null, best = Infinity;
    (j.data || []).forEach(function (p) {
      var a = p.attributes || {}, rel = p.relationships || {};
      var tr = rel.trip && rel.trip.data;
      var trip = tr ? inc['trip:' + tr.id] : null;
      var name = trip && trip.attributes ? String(trip.attributes.name || '') : '';
      if (!name || name !== String(item.train)) return; // exact train number, no substring matches
      var sc = rel.schedule && rel.schedule.data ? inc['schedule:' + rel.schedule.data.id] : null;
      var sched = sc && sc.attributes && sc.attributes.departure_time ? Date.parse(sc.attributes.departure_time) : 0;
      var sr = String(a.schedule_relationship || '').toUpperCase();
      var cancelled = sr === 'CANCELLED' || sr === 'SKIPPED';
      if (!a.departure_time && !cancelled) return;
      var dep = a.departure_time ? Date.parse(a.departure_time) : 0;
      var diff = Math.abs((dep || sched || item.dep) - item.dep);
      if (diff > 3 * 3600000 || diff >= best) return; // same day's run only
      best = diff;
      var st = rel.stop && rel.stop.data;
      var stopRec = st ? inc['stop:' + st.id] : null;
      hit = { dep: dep, sched: sched, cancelled: cancelled, track: trackOf(stopRec), headsign: trip.attributes.headsign || '',
        tripId: tr.id, routeId: rel.route && rel.route.data ? rel.route.data.id : '', stopName: stopRec && stopRec.attributes ? stopRec.attributes.name || '' : '' };
    });
    if (hit && hit.tripId) {
      var tids = readJson(K_TID, {});
      if (tids[item.key] !== hit.tripId || (hit.routeId && !tids[item.key + '|r'])) {
        tids[item.key] = hit.tripId; if (hit.routeId) tids[item.key + '|r'] = hit.routeId;
        ls(K_TID, JSON.stringify(tids));
      }
    }
    var line = item.lineName || 'Train';
    var dest = (hit && hit.headsign) || item.destName || '';
    var origin = item.originName || (hit && hit.stopName) || '';
    var toDest = dest ? ' to ' + dest : '';
    var fromOrigin = origin ? ' from ' + origin : '';
    var base = 'rr-trip-' + item.key;
    var flagsChanged = false;
    if (hit && hit.cancelled) {
      markFired(item.key + '-cx');
      await notify('Train cancelled', line + ' ' + item.train + toDest + fromOrigin + ' has been cancelled', base + '-cx');
      syncServer();
      return;
    }
    var sched = (hit && hit.sched) || item.dep;
    var pred = (hit && hit.dep) || 0;
    var lateMin = pred && sched ? Math.round((pred - sched) / 60000) : 0;
    var leaves = pred || sched;
    var gone = hit ? (pred && pred < now - 60000) : now > sched + 120000;
    f = fired();
    if (!f[item.key + '-30'] && !gone && sched - now <= HEADSUP_MS && (hit || sched - now <= 15 * 60000)) {
      var mins = Math.max(1, Math.round((leaves - now) / 60000));
      var body = lateMin >= LATE_MIN
        ? line + ' ' + item.train + toDest + ' is expected to depart ' + lateMin + ' min late at ' + fmtTime(pred) + fromOrigin
        : line + ' ' + item.train + toDest + ' is expected to depart On Time at ' + fmtTime(sched) + fromOrigin;
      markFired(item.key + '-30');
      if (lateMin >= LATE_MIN) markFired(item.key + '-late');
      await notify('Departing in ' + mins + ' min', body, base + '-30');
      flagsChanged = true;
    } else if (f[item.key + '-30'] && hit && pred > now && lateMin >= LATE_MIN && (!f[item.key + '-late'] || now - f[item.key + '-late'] >= LATE_EVERY_MS - 30000)) {
      markFired(item.key + '-late');
      await notify(line + ' ' + item.train + ' is delayed by ' + fmtDelay(lateMin),
        'Now expected to depart ' + (origin ? origin + ' ' : '') + 'at ' + fmtTime(pred),
        base + '-late', LATE_EVERY_MS - 30000);
    }
    if (!fired()[item.key] && hit && hit.track && !gone) {
      markFired(item.key);
      await notify('Boarding on track ' + hit.track, line + ' ' + item.train + ' (' + fmtTime(item.dep) + ')' + toDest, base);
      flagsChanged = true;
    }
    if (flagsChanged) syncServer(); // tell the worker so its push doesn't repeat these
  }

  async function tick() {
    if (!enabled()) return;
    if (document.visibilityState === 'hidden' && !isStandalone() && isMobileDevice()) return;
    var now = Date.now();
    var q = readJson(K_Q, []);
    var due = q.filter(function (it) {
      var f = fired();
      return it && it.railroad === 'mbta' && it.originId && it.train && !f[it.key + '-cx'] &&
        it.dep - now <= BEFORE_MS && now <= tripEnd(it);
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

  // Items: [{ key, railroad, lineName, routeId, train, dep (ms), arr (ms), originId (place-*), originName, destName }]
  function setTrips(items) {
    var now = Date.now();
    var clean = (items || []).filter(function (it) {
      return it && it.key && it.railroad === 'mbta' && it.train && it.originId && isFinite(it.dep) && tripEnd(it) > now && it.dep < now + 7 * 86400000;
    }).slice(0, 20);
    ls(K_Q, JSON.stringify(clean));
    syncServer();
  }
  function clearTrips() { ls(K_Q, null); syncServer(); }

  async function setEnabled(on) {
    if (!on) { ls(K_ON, '0'); stop(); syncServer(true); return { on: false }; }
    if (!supported()) return { on: false, reason: 'unsupported' };
    var perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (_) {} }
    if (perm !== 'granted') { ls(K_ON, '0'); return { on: false, reason: perm === 'denied' ? 'denied' : 'dismissed' }; }
    try { if (!(await navigator.serviceWorker.getRegistration('/'))) await navigator.serviceWorker.register('/sw.js'); } catch (_) {}
    ls(K_ON, '1'); start();
    syncServer(true);
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
      if (r.on) say('On. You\'ll get an alert when your MBTA train is boarding on its track, while RailroadRadar is open, and with it closed where this browser supports push.');
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
