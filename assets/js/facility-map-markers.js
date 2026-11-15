(function () {
  'use strict';
  if (window.__rrFacilityMapMarkers) return;
  window.__rrFacilityMapMarkers = true;
  var FACILITIES = [
    { name: 'Southampton Street Yard', lat: 42.33293, lon: -71.06091, agency: 'amtrak', color: '#00529B' },
    { name: 'Readville Layover', lat: 42.23232, lon: -71.13580, agency: 'mbta', color: '#80276C' },
    { name: 'Boston Engine Terminal', lat: 42.37500, lon: -71.07583, agency: 'mbta', color: '#80276C' }
  ];
  var PIN = 16;
  function getMap() { var m = window.__rrLiveMap; return m && typeof m.addLayer === 'function' ? m : null; }
  function hookLeafletMap() {
    if (!window.L || !L.Map || L.Map.prototype.__rrFacilityMapHook) return;
    L.Map.prototype.__rrFacilityMapHook = true;
    var original = L.Map.prototype.addLayer;
    L.Map.prototype.addLayer = function (layer) {
      if (!window.__rrLiveMap && this.getContainer && this.getContainer().id === 'map') {
        window.__rrLiveMap = this; addMarkers(this);
      }
      return original.call(this, layer);
    };
  }
  var facilityMarkers = [];
  var MIN_MARKER_ZOOM = 11;
  function setFacilityMarkersVisible(visible) {
    facilityMarkers.forEach(function (marker) {
      var el = marker.getElement();
      if (el) el.style.visibility = visible ? '' : 'hidden';
      if (!visible && marker.isPopupOpen()) marker.closePopup();
    });
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function asDate(v) {
    if (!v) return null;
    var d = v.toDate ? v.toDate() : (v instanceof Date ? v : new Date(v));
    return d && !isNaN(d.getTime()) ? d : null;
  }
  function ago(v) {
    var d = asDate(v);
    if (!d) return '';
    var min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'Just Now';
    if (min < 60) return min + ' Min Ago';
    var hr = Math.round(min / 60);
    if (hr < 24) return hr + ' Hr Ago';
    var days = Math.round(hr / 24);
    return days + (days === 1 ? ' Day Ago' : ' Days Ago');
  }
  function publicName(r) {
    var label = String(r.reportedByLabel || '').trim();
    var uid = String(r.reportedByUid || '');
    if (!label || label.indexOf('@') !== -1 || (uid && label === uid)) return 'Anonymous';
    if (/^[A-Za-z0-9_-]{20,128}$/.test(label)) return 'Anonymous';
    return label.slice(0, 80);
  }
  function statusOf(r) {
    return r.reportType === 'shopped' ? 'Shopped' : 'Stored';
  }
  function atFacility(r, name) {
    if (r.reportType === 'facility') return String(r.facility || '') === name;
    if (r.reportType === 'shopped') return String(r.location || '') === name;
    return false;
  }
  function unitsOf(r) {
    var out = [];
    (Array.isArray(r.locomotives) ? r.locomotives : []).forEach(function (id) {
      var n = String(id || '').trim();
      if (n && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }
  function iconFor(facility, number) {
    if (facility.agency !== 'mbta' || typeof window.rrMbtaLocoIconFor !== 'function') return '';
    var url = String(window.rrMbtaLocoIconFor(number) || '');
    return url.indexOf('/assets/') === 0 && url.indexOf('..') === -1 ? url : '';
  }
  function popupOpts() {
    var vw = 520;
    try { vw = window.innerWidth || 520; } catch (_) {}
    var phone = vw <= 700;
    var w = phone ? Math.min(336, Math.max(160, vw - 40)) : 350;
    return {
      maxWidth: w,
      minWidth: Math.min(240, w),
      closeButton: true,
      autoPan: true,
      autoPanPaddingTopLeft: L.point(phone ? 20 : 5, 84),
      autoPanPaddingBottomRight: L.point(phone ? 20 : 5, 12)
    };
  }
  function shell(title, body) {
    return '<div class="station-popup rr-sp rr-facility-popup"><div class="rr-sp-head"><div class="rr-sp-title">' +
      esc(title) + '</div><div class="rr-sp-sub">Equipment</div></div>' + body + '</div>';
  }
  function rowHtml(facility, r, number) {
    var icon = iconFor(facility, number);
    var img = icon ? '<img class="rr-facility-eq-icon" src="' + esc(icon) + '" alt="">' : '<span class="rr-facility-eq-icon rr-facility-eq-icon-empty"></span>';
    return '<li class="rr-facility-eq"><span class="rr-facility-eq-main">' + img +
      '<span class="rr-facility-eq-copy"><span class="rr-facility-eq-num">' + esc(number) + '</span>' +
      '<span class="rr-facility-eq-meta"><span class="rr-facility-eq-status">' + statusOf(r) + '</span>' +
      '<span class="rr-facility-eq-who">' + esc(publicName(r)) + '</span></span></span></span>' +
      '<span class="rr-facility-eq-when">' + esc(ago(r.approvedAt || r.createdAt)) + '</span></li>';
  }
  function listHtml(facility, rows) {
    if (!rows.length) return shell(facility.name, '<div class="rr-sp-empty">No Equipment Reported Here</div>');
    var items = [];
    rows.forEach(function (r) {
      unitsOf(r).forEach(function (number) { items.push(rowHtml(facility, r, number)); });
    });
    if (!items.length) return shell(facility.name, '<div class="rr-sp-empty">No Equipment Reported Here</div>');
    return shell(facility.name, '<ul class="rr-sp-list rr-facility-eq-list">' + items.join('') + '</ul>');
  }
  function loadPopup(marker, facility) {
    var popup = marker.getPopup();
    if (!popup || !marker.isPopupOpen()) return;
    popup.setContent(shell(facility.name, '<div class="rr-sp-empty">Loading Reported Equipment</div>'));
    var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
    if (!db) {
      popup.setContent(shell(facility.name, '<div class="rr-sp-empty">Equipment Reports Are Temporarily Unavailable</div>'));
      return;
    }
    db.collection('yardReports').get().then(function (snap) {
      if (!marker.isPopupOpen()) return;
      var rows = snap.docs.map(function (d) { return d.data() || {}; }).filter(function (r) { return atFacility(r, facility.name); });
      rows.sort(function (a, b) {
        function time(r) { var d = asDate(r.approvedAt || r.createdAt); return d ? d.getTime() : 0; }
        return time(b) - time(a);
      });
      popup.setContent(listHtml(facility, rows));
    }).catch(function (err) {
      console.error('[facility markers] equipment lookup failed', err);
      if (marker.isPopupOpen()) popup.setContent(shell(facility.name, '<div class="rr-sp-empty">Could Not Load Equipment Reports</div>'));
    });
  }
  function addMarkers(map) {
    if (map.__rrFacilityMarkersAdded || !window.L) return;
    map.__rrFacilityMarkersAdded = true;
    var layer = L.layerGroup();
    FACILITIES.forEach(function (facility) {
      var html = '<span class="rr-facility-marker" style="--rr-facility-color:' + facility.color + '">' +
        '<span class="rr-facility-marker-pin"></span><span class="rr-facility-marker-label">' + esc(facility.name) + '</span></span>';
      var icon = L.divIcon({
        className: 'rr-facility-marker-icon',
        html: html,
        iconSize: [PIN, PIN],
        iconAnchor: [PIN / 2, PIN / 2],
        popupAnchor: [0, -10]
      });
      var marker = L.marker([facility.lat, facility.lon], {
        icon: icon,
        pane: 'markerPane',
        title: facility.name,
        keyboard: true,
        zIndexOffset: 650
      });
      marker.bindPopup(shell(facility.name, '<div class="rr-sp-empty">Loading Reported Equipment</div>'), popupOpts());
      marker.on('popupopen', function () { loadPopup(marker, facility); });
      facilityMarkers.push(marker);
      marker.addTo(layer);
    });
    layer.addTo(map);
    function onZoom() { setFacilityMarkersVisible(map.getZoom() > MIN_MARKER_ZOOM); }
    onZoom();
    map.on('zoom zoomend', onZoom);
  }
  function start() { hookLeafletMap(); var m = getMap(); if (m) addMarkers(m); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  var attempts = 0, timer = window.setInterval(function () {
    start(); attempts++;
    if ((getMap() && getMap().__rrFacilityMarkersAdded) || attempts >= 240) window.clearInterval(timer);
  }, 250);
})();
