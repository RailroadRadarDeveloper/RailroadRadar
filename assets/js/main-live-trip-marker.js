/* Public live-trip markers on the main map.
   Uses the same public Firestore shares and marker artwork as /live/user.html.
   No map controls, layout, or existing train markers are changed. */
(function () {
  'use strict';
  if (window.__rrMainLiveTripMarkers) return;
  window.__rrMainLiveTripMarkers = true;

  var WARN_MS = 150000;
  var DROP_MS = 30 * 60 * 1000;
  var map = null, unsubscribe = null;
  var markers = Object.create(null), shares = Object.create(null);

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

  function removeMarker(id) {
    var marker = markers[id];
    if (marker && map) {
      try { map.removeLayer(marker); } catch (_) {}
    }
    delete markers[id];
    delete shares[id];
  }

  function paint(id, d) {
    if (!d || d.active !== true || Number(d.expiresAt) <= Date.now() ||
        !isFinite(Number(d.lat)) || !isFinite(Number(d.lon))) {
      removeMarker(id);
      return;
    }
    var age = Date.now() - (Number(d.updatedAt) || 0);
    if (!Number(d.updatedAt) || age > DROP_MS) {
      removeMarker(id);
      return;
    }
    shares[id] = d;
    ensureStyle();
    var ll = [Number(d.lat), Number(d.lon)];
    var icon = makeIcon(d, age > WARN_MS);
    if (!markers[id]) {
      markers[id] = L.marker(ll, { icon: icon, zIndexOffset: 2000, keyboard: false }).addTo(map);
    } else {
      markers[id].setLatLng(ll);
      markers[id].setIcon(icon);
    }
  }

  function syncSnapshot(snapshot) {
    var seen = Object.create(null);
    snapshot.forEach(function (doc) {
      seen[doc.id] = true;
      paint(doc.id, doc.data() || null);
    });
    Object.keys(markers).forEach(function (id) {
      if (!seen[id]) removeMarker(id);
    });
  }

  function boot() {
    if (!window.L || !window.firebase || !firebase.firestore || !window.rrMainMap) return false;
    map = window.rrMainMap;
    var db = firebase.firestore();
    var cutoff = firebase.firestore.Timestamp.fromMillis(Date.now() - 9 * 60 * 1000);
    unsubscribe = db.collection('specialMoveShares')
      .where('active', '==', true)
      .where('expireAt', '>', cutoff)
      .onSnapshot(syncSnapshot, function () {
        Object.keys(markers).forEach(removeMarker);
      });
    return true;
  }

  var attempts = 0;
  var timer = setInterval(function () {
    attempts++;
    if (boot() || attempts >= 60) clearInterval(timer);
  }, 500);
  setInterval(function () {
    Object.keys(shares).forEach(function (id) { paint(id, shares[id]); });
  }, 5000);
  window.addEventListener('beforeunload', function () {
    if (unsubscribe) {
      try { unsubscribe(); } catch (_) {}
    }
    Object.keys(markers).forEach(removeMarker);
  });
})();
