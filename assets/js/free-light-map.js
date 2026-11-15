/* Preview only. Shared free basemap factory; never fetches a Mapbox resource.
 * MapLibre GL JS 6.17.0 + maplibre-gl-leaflet 0.1.4 are vendored with licenses.
 * Noninteractive cards become snapshots, releasing their WebGL context; snapshots
 * are serialized so a long MyTrips list cannot exhaust mobile GPU contexts.
 */
(function () {
  'use strict';
  var root = '/assets/vendor/maplibre/';
  var credit = '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
  var resources, snapshotQueue = Promise.resolve();
  function script(url) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = url; el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
    });
  }
  function load() {
    if (!resources) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = root + 'maplibre-gl.css'; document.head.appendChild(css);
      var ready = import(root + 'maplibre-gl.mjs').then(function (gl) {
        window.maplibregl = gl;
        gl.setWorkerUrl(root + 'maplibre-gl-worker.mjs');
        gl.setWorkerCount(1);
        return script(root + 'leaflet-maplibre-gl.js');
      });
      resources = new Promise(function (resolve, reject) {
        var timer = setTimeout(function () { reject(new Error('Free map library timeout')); }, 12000);
        ready.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
      });
    }
    return resources;
  }
  function slot() {
    var release;
    var prev = snapshotQueue;
    snapshotQueue = new Promise(function (resolve) { release = resolve; });
    return prev.then(function () { return release; });
  }
  window.RRFreeLightLayer = function (options) {
    var L = window.L, opts = options || {};
    var FreeLight = L.Layer.extend({
      options: { attribution: credit, minZoom: 0, maxZoom: 20 },
      initialize: function () { L.setOptions(this, opts); this._generation = 0; },
      getAttribution: function () { return credit; },
      onAdd: function (map) {
        this._snapshot = opts.snapshot === true || map.options.dragging === false;
        this._mapRef = map;
        map._addZoomLimit(this);
        this._refresh = this._schedule.bind(this);
        if (this._snapshot) map.on('moveend resize', this._refresh);
        this._schedule();
      },
      onRemove: function (map) {
        this._generation++;
        map._removeZoomLimit(this);
        clearTimeout(this._debounce); clearTimeout(this._timer);
        map.off('moveend resize', this._refresh);
        this._clearVector();
        if (this._image) { map.removeLayer(this._image); this._image = null; }
        if (this._fallback) { map.removeLayer(this._fallback); this._fallback = null; }
        this._mapRef = null;
      },
      _clearVector: function () {
        clearTimeout(this._timer);
        if (this._vector && this._mapRef) this._mapRef.removeLayer(this._vector);
        this._vector = null;
        if (this._release) { this._release(); this._release = null; }
      },
      _schedule: function () {
        if (this._fallback) return;
        clearTimeout(this._debounce);
        var self = this;
        this._debounce = setTimeout(function () { self._render(); }, 80);
      },
      _render: async function () {
        var map = this._mapRef, generation = ++this._generation, self = this;
        this._clearVector();
        try {
          await load();
          if (this._snapshot) {
            var release = await slot();
            if (this._mapRef !== map || generation !== this._generation) { release(); return; }
            this._release = release;
          }
          if (this._mapRef !== map || generation !== this._generation) return;
          var vector = this._vector = L.maplibreGL({
            style: '/assets/maps/free-light.json', padding: 0,
            interactive: false, attributionControl: false, pixelRatio: 1,
            canvasContextAttributes: { preserveDrawingBuffer: true },
            maxZoom: (opts.maxZoom || 20) - 1
          });
          vector.addTo(map);
          var gl = vector.getMaplibreMap(), errors = 0, sourceOk = false;
          var fail = function () { if (self._vector === vector) self._useFallback(); };
          gl.on('error', function () { if (++errors >= 2) fail(); });
          gl.on('sourcedata', function (ev) {
            if (ev && ev.sourceDataType === 'metadata' && ev.isSourceLoaded) sourceOk = true;
          });
          gl.on('webglcontextlost', fail);
          this._timer = setTimeout(fail, 12000);
          gl.once('idle', function () {
            if (self._vector !== vector) return;
            if (!sourceOk || errors > 0) { fail(); return; }
            clearTimeout(self._timer);
            if (!self._snapshot) { self.fire('load'); return; }
            try {
              var image = L.imageOverlay(gl.getCanvas().toDataURL('image/png'), map.getBounds(), { pane: 'tilePane', interactive: false, opacity: opts.opacity == null ? 1 : opts.opacity });
              if (self._image) map.removeLayer(self._image);
              image.addTo(map); self._image = image;
              self._clearVector();
            } catch (_) { fail(); }
          });
        } catch (_) { if (this._mapRef === map && generation === this._generation) this._useFallback(); }
      },
      _useFallback: function () {
        var map = this._mapRef;
        if (!map || this._fallback) return;
        this._clearVector();
        if (this._image) { map.removeLayer(this._image); this._image = null; }
        var fallback = this._fallback = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> © <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: opts.maxZoom || 20, detectRetina: false, opacity: opts.opacity == null ? 1 : opts.opacity
        });
        var errors = 0, self = this;
        fallback.on('tileerror', function () {
          if (++errors === 2 && self._mapRef === map) {
            map.removeLayer(fallback);
            self._fallback = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
              maxNativeZoom: 19, maxZoom: opts.maxZoom || 20, detectRetina: false
            }).addTo(map);
          }
        });
        fallback.addTo(map);
        this.fire('fallback');
      }
    });
    return new FreeLight();
  };
})();
