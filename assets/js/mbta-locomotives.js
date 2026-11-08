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

  root.rrMbtaLocoByNumber = byNumber;
  root.rrMbtaLocoIconFor = iconFor;
  root.rrMbtaLocoPaintIconFor = paintIconFor;
  root.rrMbtaLocoTypeIcon = typeIcon;
  root.rrMbtaLocoRosterList = function () { return list.slice(); };
  root.rrMbtaLocoIndexRoster = indexRoster;
  root.rrMbtaLocoRosterIsReady = false;

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
        finish();
        return list;
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
