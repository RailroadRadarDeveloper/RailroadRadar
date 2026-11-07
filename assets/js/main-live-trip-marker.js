/* Live trip marker on the main map.
   Reuses the live-share document and the same marker artwork as /live/user.html.
   No map controls, layout, or existing train markers are changed. */
(function () {
  'use strict';
  if (window.__rrMainLiveTripMarker) return;
  window.__rrMainLiveTripMarker = true;

  var KEY = 'rrSpecialMoveShareV1';
  var STOP = 'rrSpecialShareStopped';
  var WARN_MS = 150000;
  var DROP_MS = 30 * 60 * 1000;
  var map = null, marker = null, unsubscribe = null, activeCode = '';
  var latest = null;

  function readShare() {
    try {
      if (localStorage.getItem(STOP) === '1') return null;
      var raw = localStorage.getItem(KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!o || !o.shareCode || Number(o.expiresAt) <= Date.now()) return null;
      return o;
    } catch (_) { return null; }
  }

  function ensureStyle() {
    if (document.getElementById('rr-main-live-marker-style')) return;
    var style = document.createElement('style');
    style.id = 'rr-main-live-marker-style';
    style.textContent =
      '.rr-live-train{background:transparent!important;border:0!important}' +
      '.rr-live-pin{position:relative;width:76px;height:70px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}' +
      '.rr-live-pin.is-stale{opacity:.45;filter:grayscale(.35) drop-shadow(0 1px 2px rgba(0,0,0,.3))}' +
      '.rr-live-halo{position:absolute;top:10px;left:50%;width:44px;height:44px;margin-left:-22px;border-radius:50%;background:rgba(7,9,62,.22);box-shadow:0 0 0 3px rgba(255,255,255,.85),0 0 14px rgba(7,9,62,.35);pointer-events:none}' +
      'html.rr-theme-dark .rr-live-halo{background:rgba(255,255,255,.16);box-shadow:0 0 0 3px rgba(7,9,62,.75),0 0 16px rgba(0,0,0,.45)}' +
      '.rr-live-pin img{position:relative;z-index:1;width:68px;height:30px;object-fit:contain;display:block;margin-top:17px}' +
      '.rr-live-pin-label{position:relative;z-index:2;margin-top:4px;max-width:120px;padding:2px 6px;border-radius:4px;background:rgba(7,9,62,.88);color:#fff;font:700 11px/1.2 sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.35)}' +
      'html.rr-theme-dark .rr-live-pin-label{background:rgba(21,26,82,.95)}';
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  function makeIcon(d, stale) {
    var heading = Number(d.heading);
    var rot = isFinite(heading) ? heading : 90;
    var src = /^\/assets\/[A-Za-z0-9-]+\.png$/.test(d.icon || '') ? d.icon : '/assets/hsp46.png';
    var title = esc(String(d.title || 'Live trip').slice(0, 40));
    return L.divIcon({
      className: 'rr-live-train',
      html: '<div class="rr-live-pin' + (stale ? ' is-stale' : '') + '">' +
        '<span class="rr-live-halo" aria-hidden="true"></span>' +
        '<img src="' + src + '" alt="" style="transform:rotate(' + rot + 'deg)">' +
        '<span class="rr-live-pin-label">' + title + '</span></div>',
      iconSize: [76, 70],
      iconAnchor: [38, 32]
    });
  }

  function removeMarker() {
    if (marker && map) {
      try { map.removeLayer(marker); } catch (_) {}
    }
    marker = null;
  }

  function paint(d) {
    latest = d || null;
    if (!d || d.active !== true || Number(d.expiresAt) <= Date.now() ||
        !isFinite(Number(d.lat)) || !isFinite(Number(d.lon))) {
      removeMarker();
      return;
    }
    var age = Date.now() - (Number(d.updatedAt) || 0);
    if (!Number(d.updatedAt) || age > DROP_MS) {
      removeMarker();
      return;
    }
    ensureStyle();
    var ll = [Number(d.lat), Number(d.lon)];
    var icon = makeIcon(d, age > WARN_MS);
    if (!marker) marker = L.marker(ll, { icon: icon, zIndexOffset: 2000, keyboard: false }).addTo(map);
    else {
      marker.setLatLng(ll);
      marker.setIcon(icon);
    }
  }

  function stopListening() {
    if (unsubscribe) {
      try { unsubscribe(); } catch (_) {}
    }
    unsubscribe = null;
    activeCode = '';
    latest = null;
    removeMarker();
  }

  function sync() {
    var next = readShare();
    var code = next && String(next.shareCode || '').toLowerCase();
    if (!code || !/^[a-z0-9]{8,20}$/.test(code)) {
      if (activeCode) stopListening();
      return;
    }
    if (code === activeCode) {
      if (latest) paint(latest);
      return;
    }
    stopListening();
    activeCode = code;
    unsubscribe = firebase.firestore().collection('specialMoveShares').doc(code).onSnapshot(function (doc) {
      paint(doc.exists ? (doc.data() || null) : null);
    }, function () {
      removeMarker();
    });
  }

  function boot() {
    if (!window.L || !window.firebase || !firebase.firestore || !window.rrMainMap) return false;
    map = window.rrMainMap;
    try { sync(); } catch (_) {}
    return true;
  }

  var attempts = 0;
  var timer = setInterval(function () {
    attempts++;
    if (boot() || attempts >= 60) clearInterval(timer);
  }, 500);
  window.addEventListener('storage', function (event) {
    if (!event || event.key === KEY || event.key === STOP) {
      try { sync(); } catch (_) {}
    }
  });
  setInterval(function () {
    if (map) {
      try { sync(); if (latest) paint(latest); } catch (_) {}
    }
  }, 5000);
  window.addEventListener('beforeunload', stopListening);
})();
