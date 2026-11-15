(function () {
  'use strict';
  if (window.__rrFacilityMapMarkers) return;
  window.__rrFacilityMapMarkers = true;
  var FACILITIES = [
    { name: 'Southampton Street Yard', lat: 42.33293, lon: -71.06091, agency: 'amtrak', color: '#00529B' },
    { name: 'Readville Layover', lat: 42.23232, lon: -71.13580, agency: 'mbta', color: '#80276C' },
    { name: 'Boston Engine Terminal', lat: 42.37500, lon: -71.07583, agency: 'mbta', color: '#80276C' }
  ];
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
  var MIN_MARKER_ZOOM = 13;
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
    var d = null;
    if (typeof v.toDate === 'function') d = v.toDate();
    else if (typeof v.seconds === 'number') d = new Date(v.seconds * 1000);
    else d = v instanceof Date ? v : new Date(v);
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
  // Same public label Recent Reports stores on the report. Never an email or a user id.
  function publicName(r) {
    var mode = String(r.reportedByDisplayMode || '');
    var label = String(r.reportedByLabel || '').trim();
    var uid = String(r.reportedByUid || '');
    if (mode === 'anonymous' || /^anonymous$/i.test(label)) return 'Anonymous';
    if (!label || label.indexOf('@') !== -1 || label.indexOf('<') !== -1 || label.indexOf('>') !== -1) return 'Anonymous';
    if (uid && label === uid) return 'Anonymous';
    if (/^[A-Za-z0-9_-]{20,128}$/.test(label)) return 'Anonymous';
    return label.slice(0, 80);
  }
  function reporterHtml(r) {
    var name = publicName(r);
    var html = esc(name);
    if (name !== 'Anonymous' && r.reportedByVerified === true) {
      html += '<img class="admin-badge-icon verified-badge-icon is-visible" src="/assets/admin-badge.png" alt="Verified" width="11" height="11">';
    }
    return html;
  }
  function statusOf(r) {
    return r.reportType === 'shopped' ? 'Shopped' : 'Stored';
  }
  function atFacility(r, name) {
    if (!r || r.status === 'pending') return false;
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
    var w = 520;
    try { w = Math.min(window.innerWidth || 520, (window.screen && screen.width) || 520); } catch (_) {}
    if (w <= 700) {
      var boxW = Math.min(336, Math.max(160, w - 40));
      return {
        maxWidth: boxW, minWidth: Math.min(200, boxW), closeOnClick: true, autoClose: true, closeButton: true,
        autoPan: true, autoPanPaddingTopLeft: L.point(20, 84), autoPanPaddingBottomRight: L.point(20, 12)
      };
    }
    return {
      maxWidth: 350, minWidth: 240, closeOnClick: true, autoClose: true, closeButton: true,
      autoPan: true, autoPanPaddingTopLeft: L.point(5, 84), autoPanPaddingBottomRight: L.point(5, 5)
    };
  }
  var REFRESH_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>';
  function shell(facility, body) {
    var refresh = '<button type="button" class="rr-sp-refresh" title="Refresh" aria-label="Refresh" data-facility="' +
      esc(facility.name) + '" onclick="window.__rrFacilityRefresh(this)">' + REFRESH_SVG + '</button>';
    return '<div class="station-popup rr-sp rr-facility-popup"><div class="rr-sp-head"><div class="rr-sp-title">' +
      esc(facility.name) + '</div><div class="rr-sp-sub">Equipment</div>' + refresh + '</div>' + body + '</div>';
  }
  function rowHtml(facility, r, number) {
    var icon = iconFor(facility, number);
    var iconHtml = icon ? '<img src="' + esc(icon) + '" alt="">' : '';
    return '<li class="rr-sp-row" style="--rr-sp-line:' + facility.color + '"><span class="rr-sp-time">' + iconHtml + '</span>' +
      '<span class="rr-sp-main"><span class="rr-sp-dest">' + esc(number) + '</span>' +
      '<span class="rr-sp-track"><span class="rr-sp-status">' + statusOf(r) + '</span><span class="rr-facility-who">' + reporterHtml(r) + '</span></span></span>' +
      '<span class="rr-sp-chip">' + esc(ago(r.approvedAt || r.createdAt)) + '</span></li>';
  }
  function listHtml(facility, rows) {
    if (!rows.length) return shell(facility, '<div class="rr-sp-empty">No Equipment Reported Here</div>');
    var items = [];
    rows.forEach(function (r) {
      unitsOf(r).forEach(function (number) { items.push(rowHtml(facility, r, number)); });
    });
    if (!items.length) return shell(facility, '<div class="rr-sp-empty">No Equipment Reported Here</div>');
    return shell(facility, '<ul class="rr-sp-list">' + items.join('') + '</ul>');
  }
  function loadPopup(marker, facility) {
    var popup = marker.getPopup();
    if (!popup || !marker.isPopupOpen()) return;
    popup.setContent(shell(facility, '<div class="rr-sp-empty"><span class="loading-spinner"></span> Loading Equipment</div>'));
    var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
    if (!db) {
      popup.setContent(shell(facility, '<div class="rr-sp-empty">Equipment Reports Are Temporarily Unavailable</div>'));
      return;
    }
    var yardRead = (window.rrFsCache && rrFsCache.query)
      ? rrFsCache.query('yardReports', rrFsCache.PUBLIC_TTL, function () { return db.collection('yardReports').get(); })
      : db.collection('yardReports').get();
    yardRead.then(function (snap) {
      if (!marker.isPopupOpen()) return;
      var rows = snap.docs.map(function (d) { return d.data() || {}; }).filter(function (r) { return atFacility(r, facility.name); });
      rows.sort(function (a, b) {
        function time(r) { var d = asDate(r.approvedAt || r.createdAt); return d ? d.getTime() : 0; }
        return time(b) - time(a);
      });
      popup.setContent(listHtml(facility, rows));
    }).catch(function (err) {
      console.warn('[facility markers] equipment lookup failed', err);
      if (marker.isPopupOpen()) popup.setContent(shell(facility, '<div class="rr-sp-empty">Could Not Load Equipment Reports</div>'));
    });
  }
  window.__rrFacilityRefresh = function (btn) {
    var name = btn && btn.getAttribute('data-facility');
    facilityMarkers.forEach(function (marker) {
      if (marker.__rrFacility && marker.__rrFacility.name === name) loadPopup(marker, marker.__rrFacility);
    });
  };
  function addMarkers(map) {
    if (map.__rrFacilityMarkersAdded || !window.L) return;
    map.__rrFacilityMarkersAdded = true;
    var layer = L.layerGroup();
    FACILITIES.forEach(function (facility) {
      var html = '<span class="rr-facility-marker" style="--rr-facility-color:' + facility.color + '"><span class="rr-facility-marker-label">' + esc(facility.name) + '</span></span>';
      var icon = L.divIcon({
        className: 'rr-facility-marker-icon',
        html: html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -16]
      });
      var marker = L.marker([facility.lat, facility.lon], {
        icon: icon,
        pane: 'markerPane',
        title: facility.name + ' (' + (facility.agency === 'amtrak' ? 'Amtrak' : 'MBTA') + ')',
        keyboard: true,
        zIndexOffset: 650
      });
      marker.__rrFacility = facility;
      marker.bindPopup(shell(facility, '<div class="rr-sp-empty"><span class="loading-spinner"></span> Loading Equipment</div>'), popupOpts());
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
