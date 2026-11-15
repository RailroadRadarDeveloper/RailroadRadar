/* Shared free basemap. MapLibre GL JS 6.17.0 + maplibre-gl-leaflet 0.1.4 are vendored.
 * Noninteractive cards become snapshots so a long MyTrips list cannot exhaust GPU contexts.
 * Mapbox raster is used only when OpenFreeMap itself fails to load.
 */
(function () {
  'use strict';
  var root = '/assets/vendor/maplibre/';
  var credit = '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
  var MAPBOX_LIGHT = 'https://railroadradar-proxy.railroadradar.workers.dev/api/mapbox/styles/v1/northeastamtrakrailfanalt/ckyq285h5219a14mpql9jt2r7/tiles/256/{z}/{x}/{y}';
  var MAPBOX_ATTR = '© Mapbox © OpenStreetMap contributors';
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
  function mapErrorUrl(err) {
    return String(err && (err.url || '') || '');
  }
  function ignorableMapError(err) {
    var msg = String(err && (err.message || err) || '');
    var url = mapErrorUrl(err);
    var status = err && err.status;
    if (err && err.name === 'AbortError') return true;
    if (/abort/i.test(msg)) return true;
    if (status === 404) return true;
    if (/\/fonts\/|glyph|sprite/i.test(url + ' ' + msg)) return true;
    if (/\.pbf(\?|$)/i.test(url)) return true;
    return false;
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
          var gl = vector.getMaplibreMap(), rendered = false;
          var fail = function (why) {
            try { console.warn('[RailroadRadar] Free map falling back', why || ''); } catch (_) {}
            if (self._vector === vector) self._useFallback();
          };
          gl.on('error', function (ev) {
            var err = ev && ev.error;
            try { console.warn('[RailroadRadar] Free map error', err && err.message ? err.message : err); } catch (_) {}
            if (ignorableMapError(err)) return;
            fail(err && err.message);
          });
          gl.on('sourcedata', function (ev) {
            if (ev && ev.sourceDataType === 'content') rendered = true;
          });
          gl.on('webglcontextlost', function () { fail('webgl context lost'); });
          this._timer = setTimeout(function () { if (!rendered) fail('no tiles rendered'); }, 20000);
          function onIdle() {
            if (self._vector !== vector) { gl.off('idle', onIdle); return; }
            if (!rendered) return;
            gl.off('idle', onIdle);
            clearTimeout(self._timer);
            if (!self._snapshot) { self.fire('load'); return; }
            try {
              var image = L.imageOverlay(gl.getCanvas().toDataURL('image/png'), map.getBounds(), { pane: 'tilePane', interactive: false, opacity: opts.opacity == null ? 1 : opts.opacity });
              if (self._image) map.removeLayer(self._image);
              image.addTo(map); self._image = image;
              self._clearVector();
            } catch (err) { fail(err && err.message); }
          }
          gl.on('idle', onIdle);
        } catch (err) {
          try { console.warn('[RailroadRadar] Free map library failed', err && err.message ? err.message : err); } catch (_) {}
          if (this._mapRef === map && generation === this._generation) this._useFallback();
        }
      },
      _useFallback: function () {
        var map = this._mapRef;
        if (!map || this._fallback) return;
        this._clearVector();
        if (this._image) { map.removeLayer(this._image); this._image = null; }
        var fallback = this._fallback = L.tileLayer(MAPBOX_LIGHT, {
          attribution: MAPBOX_ATTR,
          maxZoom: opts.maxZoom || 20, detectRetina: false, opacity: opts.opacity == null ? 1 : opts.opacity
        });
        fallback.addTo(map);
        this.fire('fallback');
      }
    });
    return new FreeLight();
  };
})();
