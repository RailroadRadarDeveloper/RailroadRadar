(function () {
  'use strict';
  if (window.__rrFacilityMapMarkers) return;
  window.__rrFacilityMapMarkers = true;

  var FACILITIES = [
    { name: 'Southampton Street Yard', lat: 42.33293, lon: -71.06091, agency: 'amtrak', color: '#00529B' },
    { name: 'Readville Yard', lat: 42.23232, lon: -71.13580, agency: 'mbta', color: '#003DA5' },
    { name: 'Boston Engine Terminal', lat: 42.37500, lon: -71.07583, agency: 'mbta', color: '#003DA5' }
  ];

  function getMap() {
    var target = window.__rrLiveMap;
    return target && typeof target.addLayer === 'function' ? target : null;
  }

  // Capture the actual Live Map instance when the app creates it. The app keeps
  // its map in a private scope, so window.map is not a reliable integration point.
  function hookLeafletMap() {
    if (!window.L || !L.Map || L.Map.prototype.__rrFacilityMapHook) return;
    L.Map.prototype.__rrFacilityMapHook = true;
    var originalAddLayer = L.Map.prototype.addLayer;
    L.Map.prototype.addLayer = function (layer) {
      if (!window.__rrLiveMap && this.getContainer && this.getContainer().id === 'map') {
        window.__rrLiveMap = this;
        addMarkers(this);
      }
      return originalAddLayer.call(this, layer);
    };
  }

  function addMarkers(target) {
    if (target.__rrFacilityMarkersAdded || !window.L) return;
    target.__rrFacilityMarkersAdded = true;
    var layer = L.layerGroup();
    FACILITIES.forEach(function (facility) {
      var html = '<span class="rr-facility-marker" style="--rr-facility-color:' + facility.color + '">' +
        '<span class="rr-facility-marker-label">' + facility.name + '</span></span>';
      var icon = L.divIcon({
        className: 'rr-facility-marker-icon',
        html: html,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      L.marker([facility.lat, facility.lon], {
        icon: icon,
        title: facility.name + ' (' + (facility.agency === 'amtrak' ? 'Amtrak' : 'MBTA') + ')',
        keyboard: false,
        zIndexOffset: 650
      }).addTo(layer);
    });
    layer.addTo(target);
  }

  function start() {
    hookLeafletMap();
    var target = getMap();
    if (target) addMarkers(target);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  var attempts = 0;
  var timer = window.setInterval(function () {
    start();
    attempts += 1;
    if ((getMap() && getMap().__rrFacilityMarkersAdded) || attempts >= 240) window.clearInterval(timer);
  }, 250);
})();
