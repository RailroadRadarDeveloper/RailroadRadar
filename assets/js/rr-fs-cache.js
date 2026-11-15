/* Shared Firestore read cache. Public lists live in memory and localStorage.
   Per-session docs (settings, admin) live in sessionStorage. In-flight reads are shared. */
(function (root) {
  'use strict';
  var MEM = Object.create(null);
  var FLIGHT = Object.create(null);
  var PREFIX = 'rrFs:';
  var SESS = 'rrFsSess:';
  var PUBLIC_TTL = 5 * 60 * 1000;
  var ROSTER_TTL = 10 * 60 * 1000;

  function pack(value) {
    if (value == null) return value;
    if (typeof value.toMillis === 'function' && typeof value.toDate === 'function') return { __rrTs: value.toMillis() };
    if (Object.prototype.toString.call(value) === '[object Date]') return { __rrTs: value.getTime() };
    if (Array.isArray(value)) return value.map(pack);
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (k) { out[k] = pack(value[k]); });
      return out;
    }
    return value;
  }
  function stamp(ms) {
    return {
      seconds: Math.floor(ms / 1000),
      nanoseconds: (ms % 1000) * 1000000,
      toMillis: function () { return ms; },
      toDate: function () { return new Date(ms); }
    };
  }
  function unpack(value) {
    if (value == null || typeof value !== 'object') return value;
    if (typeof value.__rrTs === 'number' && Object.keys(value).length === 1) return stamp(value.__rrTs);
    if (Array.isArray(value)) return value.map(unpack);
    var out = {};
    Object.keys(value).forEach(function (k) { out[k] = unpack(value[k]); });
    return out;
  }
  function rowsFromSnap(snap) {
    var rows = [];
    if (!snap || typeof snap.forEach !== 'function') return rows;
    snap.forEach(function (doc) {
      var data = {};
      try { data = doc.data ? (doc.data() || {}) : {}; } catch (_) { data = {}; }
      rows.push({ id: doc.id, exists: doc.exists !== false, data: pack(data) });
    });
    return rows;
  }
  function docApi(row) {
    var data = unpack(row && row.data ? row.data : {});
    return {
      id: row ? row.id : '',
      exists: !!(row && row.exists !== false && row.id),
      data: function () { return data; },
      get: function (field) { return data[field]; }
    };
  }
  function snapFromRows(rows) {
    var docs = (rows || []).map(docApi);
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs: docs,
      forEach: function (fn) { docs.forEach(function (doc) { fn(doc); }); }
    };
  }
  function storeGet(store, key) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function storeSet(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function fresh(entry, ttl) {
    if (!entry) return false;
    if (!Array.isArray(entry.rows) && !entry.doc) return false;
    if (!ttl) return true;
    return Date.now() - Number(entry.at || 0) < ttl;
  }
  function readEntry(key, ttl, session) {
    var mem = MEM[key];
    if (mem && fresh(mem, session ? 0 : ttl)) return mem;
    var store = session ? root.sessionStorage : root.localStorage;
    var entry = store ? storeGet(store, (session ? SESS : PREFIX) + key) : null;
    if (entry && fresh(entry, session ? 0 : ttl)) {
      MEM[key] = entry;
      return entry;
    }
    return null;
  }
  function writeEntry(key, entry, session) {
    entry.at = Date.now();
    MEM[key] = entry;
    var store = session ? root.sessionStorage : root.localStorage;
    if (store) storeSet(store, (session ? SESS : PREFIX) + key, entry);
  }
  function query(key, ttl, run, force) {
    if (!force) {
      var hit = readEntry(key, ttl, false);
      if (hit && Array.isArray(hit.rows)) return Promise.resolve(snapFromRows(hit.rows));
    }
    if (FLIGHT[key]) return FLIGHT[key];
    FLIGHT[key] = Promise.resolve().then(run).then(function (snap) {
      var rows = rowsFromSnap(snap);
      writeEntry(key, { rows: rows }, false);
      delete FLIGHT[key];
      return snapFromRows(rows);
    }, function (err) {
      delete FLIGHT[key];
      throw err;
    });
    return FLIGHT[key];
  }
  function doc(key, ttl, run, opts) {
    opts = opts || {};
    var session = !!opts.session;
    if (!opts.force) {
      var hit = readEntry(key, session ? 0 : ttl, session);
      if (hit && hit.doc) return Promise.resolve(docApi(hit.doc));
    }
    var flightKey = (session ? 's:' : 'd:') + key;
    if (FLIGHT[flightKey]) return FLIGHT[flightKey];
    FLIGHT[flightKey] = Promise.resolve().then(run).then(function (snap) {
      var row = {
        id: snap && snap.id,
        exists: !!(snap && snap.exists),
        data: pack(snap && snap.exists && snap.data ? (snap.data() || {}) : {})
      };
      writeEntry(key, { doc: row }, session);
      delete FLIGHT[flightKey];
      return docApi(row);
    }, function (err) {
      delete FLIGHT[flightKey];
      throw err;
    });
    return FLIGHT[flightKey];
  }
  function dropStored(prefix) {
    ['localStorage', 'sessionStorage'].forEach(function (name) {
      var store = root[name];
      if (!store) return;
      var kill = [];
      for (var i = 0; i < store.length; i++) {
        var k = store.key(i);
        if (k && (k.indexOf(PREFIX + prefix) === 0 || k.indexOf(SESS + prefix) === 0)) kill.push(k);
      }
      kill.forEach(function (k) { try { store.removeItem(k); } catch (_) {} });
    });
  }
  function drop(key) {
    delete MEM[key];
    try { root.localStorage.removeItem(PREFIX + key); } catch (_) {}
    try { root.sessionStorage.removeItem(SESS + key); } catch (_) {}
  }
  function dropPrefix(prefix) {
    Object.keys(MEM).forEach(function (k) { if (k.indexOf(prefix) === 0) delete MEM[k]; });
    dropStored(prefix);
  }
  function upsert(key, id, data) {
    var hit = MEM[key] || readEntry(key, 24 * 60 * 60 * 1000, false);
    if (!hit || !Array.isArray(hit.rows)) return;
    var row = { id: id, exists: true, data: pack(data || {}) };
    var idx = -1;
    hit.rows.forEach(function (r, i) { if (r.id === id) idx = i; });
    if (idx >= 0) hit.rows[idx] = row;
    else hit.rows.unshift(row);
    writeEntry(key, hit, false);
  }

  root.rrFsCache = {
    PUBLIC_TTL: PUBLIC_TTL,
    ROSTER_TTL: ROSTER_TTL,
    query: query,
    doc: doc,
    drop: drop,
    dropPrefix: dropPrefix,
    upsert: upsert
  };
})(window);
