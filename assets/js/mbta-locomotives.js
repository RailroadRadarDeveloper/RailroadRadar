/* MBTA commuter-rail locomotive roster and icon choice.
   The table lives in assets/data/mbta-locomotives.json. Icon files are only
   the PNGs already in /assets — this file never invents artwork.
   A number's special-paint PNG wins, then the icon for its type family, then
   the caller keeps today's default. Firestore specialUnits still override this
   in app-main.js / admin.html. */
(function (root) {
  var ROSTER_URL = '/assets/data/mbta-locomotives.json?v=8e3c05f9bf';
  // Number-specific paint that already has a file. MassDOT blue shares one PNG.
  var NUMBER_ICONS = {
    '1030': '/assets/mbta-1030.png',
    '1036': '/assets/mbta-1036.png',
    '1071': '/assets/mbta-1071.png',
    '1072': '/assets/mbta-1072.png',
    '1125': '/assets/mbta-massdot.png',
    '1129': '/assets/mbta-1129.png',
    '1130': '/assets/mbta-1130.png',
    '1136': '/assets/mbta-massdot.png',
    '1137': '/assets/mbta-massdot.png',
    '1776': '/assets/mbta-1776.png'
  };
  var byKey = Object.create(null);
  var list = [];

  function typeIcon(type) {
    var t = String(type || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (t.indexOf('F40PH') === 0) return '/assets/f40ph.png';
    if (t.indexOf('GP40') === 0) return '/assets/gp40mc.png';
    if (t.indexOf('HSP46') === 0) return '/assets/hsp46.png';
    return '';
  }

  function keysFor(raw) {
    var s = String(raw == null ? '' : raw).trim().toUpperCase();
    if (!s) return [];
    s = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    var keys = [];
    function add(k) {
      if (k && keys.indexOf(k) === -1) keys.push(k);
    }
    add(s);
    var compact = s.replace(/\s+/g, '');
    add(compact);
    if (/^\d+$/.test(compact)) {
      var n = String(parseInt(compact, 10));
      add(n);
      if (n.length < 3) add(('000' + n).slice(-3));
    }
    var mark = /^([A-Z]{2,6})(\d+)$/.exec(compact);
    if (mark) {
      add(mark[1] + ' ' + mark[2]);
      add(mark[1] + mark[2]);
    }
    return keys;
  }

  function indexRoster(locomotives) {
    byKey = Object.create(null);
    list = [];
    (locomotives || []).forEach(function (row) {
      if (!row || row.number == null) return;
      var entry = {
        number: String(row.number).trim(),
        paint: String(row.paint || '').trim(),
        type: String(row.type || '').trim()
      };
      if (!entry.number) return;
      list.push(entry);
      keysFor(entry.number).forEach(function (k) {
        if (!byKey[k]) byKey[k] = entry;
      });
    });
  }

  function byNumber(raw) {
    var keys = keysFor(raw);
    for (var i = 0; i < keys.length; i++) {
      if (byKey[keys[i]]) return byKey[keys[i]];
    }
    return null;
  }

  // Paint file for this number, otherwise the type-family file, otherwise ''.
  function iconFor(raw) {
    var row = byNumber(raw);
    if (!row) return '';
    if (NUMBER_ICONS[row.number]) return NUMBER_ICONS[row.number];
    return typeIcon(row.type) || '';
  }

  function paintIconFor(raw) {
    var row = byNumber(raw);
    if (!row || !NUMBER_ICONS[row.number]) return '';
    return NUMBER_ICONS[row.number];
  }

  // Prefix matches first, then any number that contains the query (RSTX / PNLX included).
  function search(query, limit) {
    var q = String(query || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
    if (!q || !list.length) return [];
    var cap = limit > 0 ? limit : 12;
    var scored = [];
    list.forEach(function (row) {
      var n = String(row.number).toUpperCase().replace(/[\s_-]+/g, '');
      var bare = /^\d+$/.test(n) ? String(parseInt(n, 10)) : '';
      var idx = n.indexOf(q);
      var bareIdx = bare ? bare.indexOf(q) : -1;
      if (idx === -1 && bareIdx === -1) return;
      var rank = 2;
      if (n === q || bare === q) rank = 0;
      else if (idx === 0 || bareIdx === 0) rank = 1;
      scored.push({ row: row, rank: rank });
    });
    scored.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.row.number < b.row.number ? -1 : a.row.number > b.row.number ? 1 : 0;
    });
    return scored.slice(0, cap).map(function (s) { return s.row; });
  }

  root.rrMbtaLocoByNumber = byNumber;
  root.rrMbtaLocoIconFor = iconFor;
  root.rrMbtaLocoPaintIconFor = paintIconFor;
  root.rrMbtaLocoTypeIcon = typeIcon;
  root.rrMbtaLocoSearch = search;
  root.rrMbtaLocoRosterList = function () { return list.slice(); };
  root.rrMbtaLocoIndexRoster = indexRoster;
  root.rrMbtaLocoRosterIsReady = false;

  function applyFirestoreRoster() {
    if (!root.firebase || !root.firebase.apps || !root.firebase.apps.length) return Promise.resolve(list);
    try {
      return root.firebase.firestore().collection('locomotiveRoster').get().then(function (snap) {
        var merged = Object.create(null);
        list.forEach(function (row) { merged[String(row.number).toUpperCase()] = row; });
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var number = String(d.number || '').trim();
          if (!number) return;
          var key = number.toUpperCase();
          if (d.active === false) { delete merged[key]; return; }
          merged[key] = { number: number, type: String(d.type || ''), paint: String(d.paint || '') };
        });
        indexRoster(Object.keys(merged).map(function (key) { return merged[key]; }));
        return list;
      }).catch(function (err) {
        console.warn('[mbta locomotives] Firestore roster overlay unavailable; using built-in roster', err);
        return list;
      });
    } catch (err) {
      console.warn('[mbta locomotives] Firestore roster overlay unavailable; using built-in roster', err);
      return Promise.resolve(list);
    }
  }
  root.rrReloadMbtaLocoRoster = function () {
    return applyFirestoreRoster().then(function () { finish(); return list; });
  };

  function finish() {
    root.rrMbtaLocoRosterIsReady = true;
    if (typeof root.rrMbtaLocoRosterLoaded === 'function') {
      try { root.rrMbtaLocoRosterLoaded(); } catch (_) {}
    }
  }

  if (typeof fetch === 'function') {
    root.rrMbtaLocoRosterReady = fetch(ROSTER_URL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        indexRoster(data && data.locomotives);
        return applyFirestoreRoster().then(function () { finish(); return list; });
      })
      .catch(function (err) {
        console.warn('[mbta locomotives] roster failed', err);
        finish();
        return list;
      });
  } else {
    root.rrMbtaLocoRosterReady = Promise.resolve(list);
  }
})(typeof window !== 'undefined' ? window : globalThis);
