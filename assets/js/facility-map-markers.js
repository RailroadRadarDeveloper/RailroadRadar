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
  var MIN_MARKER_ZOOM = 11;
  function setFacilityMarkersVisible(visible) {
    facilityMarkers.forEach(function (marker) {
      var el = marker.getElement();
      if (el) el.style.visibility = visible ? '' : 'hidden';
      if (!visible && marker.isPopupOpen()) marker.closePopup();
    });
  }
  function updateMarkerScale(map) {
    if (!map || !map.getContainer) return;
    var z = map.getZoom();
    var visible = z > MIN_MARKER_ZOOM;
    map.getContainer().style.setProperty('--rr-facility-marker-scale', Math.max(0.72, Math.min(1, Math.pow(0.88, 12 - z))).toFixed(3));
    setFacilityMarkersVisible(visible);
  }
  function message(title, text) {
    var box = document.createElement('div'); box.className = 'rr-facility-popup';
    var h = document.createElement('strong'); h.textContent = title; box.appendChild(h);
    var p = document.createElement('p'); p.textContent = text; box.appendChild(p); return box;
  }
  function matches(r, name) {
    if (r.reportType === 'facility') return String(r.facility || '') === name;
    if (r.reportType === 'shopped') return String(r.location || '') === name;
    if (r.reportType === 'special_move') {
      var v = r.arrivalAt, d = v && v.toDate ? v.toDate() : new Date(v || 0);
      return d && !isNaN(d.getTime()) && d.getTime() > Date.now() &&
        (String(r.fromLocation || '') === name || String(r.toLocation || '') === name);
    }
    return false;
  }
  function equipment(r) {
    var a = Array.isArray(r.locomotives) ? r.locomotives.slice() : [];
    if (r.equipment && a.indexOf(String(r.equipment)) < 0) a.push(String(r.equipment));
    return a.join(', ') || 'Equipment not specified';
  }
  function loadPopup(marker, facility) {
    var popup = marker.getPopup(); if (!popup || !marker.isPopupOpen()) return;
    popup.setContent(message(facility.name, 'Loading reported equipment…'));
    var db = window.firebase && firebase.firestore ? firebase.firestore() : null;
    if (!db) { popup.setContent(message(facility.name, 'Equipment reports are temporarily unavailable.')); return; }
    db.collection('yardReports').get().then(function (snap) {
      if (!marker.isPopupOpen()) return;
      var rows = snap.docs.map(function (d) { return d.data() || {}; }).filter(function (r) { return matches(r, facility.name); });
      rows.sort(function (a, b) {
        function time(r) { var v = r.approvedAt || r.createdAt; return v && v.toDate ? v.toDate().getTime() : new Date(v || 0).getTime(); }
        return time(b) - time(a);
      });
      var box = document.createElement('div'); box.className = 'rr-facility-popup';
      var h = document.createElement('strong'); h.textContent = facility.name; box.appendChild(h);
      if (!rows.length) {
        var empty = document.createElement('p'); empty.textContent = 'No equipment has been reported at this location.'; box.appendChild(empty);
      } else rows.forEach(function (r) {
        var item = document.createElement('div'); item.className = 'rr-facility-popup-report';
        var eq = document.createElement('strong'); eq.textContent = equipment(r); item.appendChild(eq);
        var detail = document.createElement('p');
        detail.textContent = r.reportType === 'shopped' ? 'Stored/Shopped' : r.reportType === 'special_move' ? 'Special move involving this location' : 'Facility report';
        if (r.reason) detail.textContent += ' · ' + r.reason;
        item.appendChild(detail); box.appendChild(item);
      });
      popup.setContent(box);
    }).catch(function (err) {
      console.error('[facility markers] equipment lookup failed', err);
      if (marker.isPopupOpen()) popup.setContent(message(facility.name, 'Could not load equipment reports.'));
    });
  }
  function addMarkers(map) {
    if (map.__rrFacilityMarkersAdded || !window.L) return;
    map.__rrFacilityMarkersAdded = true;
    var layer = L.layerGroup();
    FACILITIES.forEach(function (facility) {
      var html = '<span class="rr-facility-marker" style="--rr-facility-color:' + facility.color + '"><span class="rr-facility-marker-label">' + facility.name + '</span></span>';
      var icon = L.divIcon({ className: 'rr-facility-marker-icon', html: html, iconSize: [260, 36], iconAnchor: [130, 18] });
      var marker = L.marker([facility.lat, facility.lon], {
        icon: icon, title: facility.name + ' (' + (facility.agency === 'amtrak' ? 'Amtrak' : 'MBTA') + ')',
        keyboard: true, zIndexOffset: 650
      });
      marker.bindPopup(message(facility.name, 'Click to load reported equipment.'), { maxWidth: 320 });
      marker.on('popupopen', function () { loadPopup(marker, facility); });
      facilityMarkers.push(marker);
      marker.addTo(layer);
    });
    layer.addTo(map);
    updateMarkerScale(map);
    // Hide labels for the entire zoom animation so they never sweep across the map.
    // They reappear at their correct geographic positions once the zoom settles.
    map.on('zoomstart', function () { setFacilityMarkersVisible(false); });
    map.on('zoomend', function () { updateMarkerScale(map); });
  }
  function start() { hookLeafletMap(); var m = getMap(); if (m) addMarkers(m); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  var attempts = 0, timer = window.setInterval(function () {
    start(); attempts++;
    if ((getMap() && getMap().__rrFacilityMarkersAdded) || attempts >= 240) window.clearInterval(timer);
  }, 250);
})();