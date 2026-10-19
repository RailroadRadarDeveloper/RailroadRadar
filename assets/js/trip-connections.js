/* MyTrips connection warnings. For a saved trip with a change of trains, compares when the inbound train
   is expected to reach the change station with when the next train is expected to leave it, and shows a
   plain message on the MyTrips card and in the trip detail: OK, tight, or likely missed.
   Live sources, best first: MBTA predictions at the change station; Amtrak per-station predicted times
   (Amtraker, already loaded by the map); the live delay of either train (any railroad), added to its
   scheduled time. With no live data it falls back to the saved schedule.
   Reads only what the page already has plus at most one MBTA predictions request per change station per
   minute, and only for trips whose connection is within the next 3 hours. Nothing is written anywhere. */
(function () {
  'use strict';
  var API = 'https://railroadradar-proxy.railroadradar.workers.dev';
  var WINDOW_BEFORE_MS = 3 * 3600000;   // start watching 3 h before the connecting train is due to leave
  var WINDOW_AFTER_MS = 5 * 60000;      // stop shortly after it has left
  var POLL_MS = 45000;
  var predCache = {};                   // stop -> { at, rows, promise }
  var nextCache = {};                   // conn key -> { at, value }
  var results = {};                     // trip id -> [assessment]
  var timer = null;

  function ms(raw) {
    if (!raw) return NaN;
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw.toDate === 'function') return raw.toDate().getTime();
    return Date.parse(raw);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtTime(t) { try { return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch (_) { return ''; } }
  function minutes(n) { n = Math.abs(n); return n === 1 ? '1 min' : n + ' min'; }
  function rrOf(s) { return String((s && s.railroad) || '').toLowerCase().trim(); }
  function norm(s) { return String(s || '').toLowerCase().replace(/\b(station|amtrak|terminal)\b/g, '').replace(/[^a-z0-9]+/g, ''); }
  function trainNum(s) { return String((s && s.trainNumber) || '').split('/')[0].replace(/^#/, '').trim(); }

  function lineName(s) {
    var named = String((s && s.lineName) || '').trim();
    if (named) return named;
    var rr = rrOf(s), lid = String((s && s.lineId) || '');
    try {
      if (typeof TRIP_LINE_STOPS !== 'undefined' && TRIP_LINE_STOPS[rr] && TRIP_LINE_STOPS[rr][lid] && TRIP_LINE_STOPS[rr][lid].n) {
        return TRIP_LINE_STOPS[rr][lid].n + (rr === 'mnr' ? ' Line' : '');
      }
    } catch (_) {}
    return '';
  }
  // "Hartford Line Train 1234 to Springfield": line first, then train number, then destination.
  function trainLabel(s, headsign) {
    var parts = [];
    var ln = lineName(s); if (ln) parts.push(ln);
    var n = trainNum(s); parts.push(n ? 'Train ' + n : 'your next train');
    var to = String(headsign || (s && s.destName) || '').trim();
    if (to) parts.push('to ' + to);
    return parts.join(' ');
  }

  function stationList(rr) {
    try {
      if (rr === 'mbta' && typeof MBTA_TRIP_STATIONS !== 'undefined') return MBTA_TRIP_STATIONS;
      if (rr === 'mnr' && typeof MNR_TRIP_STATIONS !== 'undefined') return MNR_TRIP_STATIONS;
      if ((rr === 'amtrak' || rr === 'ctrail') && typeof AMTRAK_TRIP_STATIONS !== 'undefined') return AMTRAK_TRIP_STATIONS;
    } catch (_) {}
    return null;
  }
  function stationLL(rr, id) {
    var list = stationList(rr); if (!list || !id) return null;
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return [Number(list[i].lat), Number(list[i].lon)];
    return null;
  }
  function miles(a, b) {
    var R = 3958.76, t = Math.PI / 180, dLat = (b[0] - a[0]) * t, dLon = (b[1] - a[1]) * t;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* Minimum time to change trains. Same station and railroad 5 min; another railroad 8 min; any Amtrak
     leg 10 min (longer walks and boarding lines at the big Amtrak stations); two different stations 20 min. */
  function minTransfer(a, b) {
    var ra = rrOf(a), rb = rrOf(b);
    var sameName = norm(a.destName) && norm(a.destName) === norm(b.originName);
    var sameId = String(a.destStationId || '') && String(a.destStationId || '') === String(b.originStationId || '');
    var walk = 0;
    if (!sameId && !sameName) {
      var p = stationLL(ra, a.destStationId), q = stationLL(rb, b.originStationId);
      if (p && q && miles(p, q) > 0.4) walk = 1;
    }
    if (walk) return { min: 20, walk: true };
    if (ra === 'amtrak' || rb === 'amtrak') return { min: 10 };
    if (ra !== rb) return { min: 8 };
    return { min: 5 };
  }

  function connectionsOf(data) {
    var segs = Array.isArray(data && data.segments) ? data.segments : [];
    if (segs.length < 2 || (data && data.specialMove === true)) return [];
    var out = [];
    for (var i = 0; i < segs.length - 1; i++) {
      var a = segs[i], b = segs[i + 1];
      var arr = ms(a.arriveTime), dep = ms(b.departTime);
      if (!isFinite(arr) || !isFinite(dep)) continue;
      var m = minTransfer(a, b);
      out.push({ i: i, a: a, b: b, schedArr: arr, schedDep: dep, min: m.min, walk: !!m.walk,
        station: String(a.destName || b.originName || 'your change').trim(), toStation: String(b.originName || '').trim() });
    }
    return out;
  }

  /* ---------- live sources ---------- */
  function mbtaPlace(id) {
    id = String(id || '');
    if (/^place-/.test(id)) return id;
    if (/^[A-Z]{2,5}-\d{4}/.test(id)) return 'place-' + id.replace(/-\d{2}$|-[A-Z]$/, '');
    return '';
  }
  function mbtaStopRows(stop) {
    var c = predCache[stop], now = Date.now();
    if (c && now - c.at < 55000) return c.promise;
    var url = API + '/api/mbta/predictions?filter[stop]=' + encodeURIComponent(stop) + '&filter[route_type]=2&include=trip&page[limit]=150';
    var p = fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var inc = {}, rows = [];
      ((j && j.included) || []).forEach(function (x) { inc[x.type + ':' + x.id] = x; });
      ((j && j.data) || []).forEach(function (pr) {
        var a = pr.attributes || {}, rel = pr.relationships || {};
        var tr = rel.trip && rel.trip.data ? inc['trip:' + rel.trip.data.id] : null;
        var ta = (tr && tr.attributes) || {};
        rows.push({ name: String(ta.name || ''), headsign: ta.headsign || '', dir: ta.direction_id, tripId: tr ? tr.id : '',
          route: rel.route && rel.route.data ? rel.route.data.id : '',
          arr: ms(a.arrival_time), dep: ms(a.departure_time), cancelled: /CANCELLED|SKIPPED/i.test(String(a.schedule_relationship || '')) });
      });
      return rows;
    }).catch(function () { return []; });
    predCache[stop] = { at: now, promise: p };
    return p;
  }
  function nearest(rows, name, want, field) {
    var best = null, bd = Infinity;
    rows.forEach(function (r) {
      if (r.name !== name) return;
      var t = r[field] || r.arr || r.dep; var d = Math.abs((t || want) - want);
      if (d < bd && d < 3 * 3600000) { bd = d; best = r; }
    });
    return best;
  }
  function amtrakStop(seg, code, want, field) {
    try {
      var list = window.rrConnAmtrakTrains ? window.rrConnAmtrakTrains() : [];
      var n = trainNum(seg), c = String(code || '').toUpperCase();
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (String(t.trainNum || t.trainNumRaw || '') !== n) continue;
        var st = (t.stations || []).filter(function (s) { return String(s.code || '').toUpperCase() === c; })[0];
        if (!st) continue;
        var sch = ms(field === 'arr' ? (st.schArr || st.schDep) : (st.schDep || st.schArr));
        if (isFinite(sch) && Math.abs(sch - want) > 3 * 3600000) continue; // another day's run
        var live = ms(field === 'arr' ? (st.arr || st.dep) : (st.dep || st.arr));
        if (isFinite(live)) return { t: live, done: /departed|arrived/i.test(String(st.status || '')) };
      }
    } catch (_) {}
    return null;
  }
  function liveDelay(seg) {
    try {
      if (typeof window.rrFindSharedTrain !== 'function') return null;
      var n = trainNum(seg); if (!n) return null;
      var row = window.rrFindSharedTrain({ agency: rrOf(seg), id: n });
      if (!row) return null;
      if (row.delayMinutes != null && isFinite(Number(row.delayMinutes))) return Math.round(Number(row.delayMinutes));
      var m = String(row.statusText || '').match(/(\d+)\s*min/i);
      if (m) return /early/i.test(row.statusText) ? -Number(m[1]) : Number(m[1]);
      if (/on.?time/i.test(String(row.statusText || ''))) return 0;
    } catch (_) {}
    return null;
  }
  async function liveTimes(c) {
    if (window.rrConn.testLive) return window.rrConn.testLive(c);
    var out = { inArr: null, outDep: null, inLive: false, outLive: false, outCancelled: false, headsign: '' };
    var ra = rrOf(c.a), rb = rrOf(c.b);
    if (ra === 'mbta' || rb === 'mbta') {
      var stopA = mbtaPlace(c.a.destStationId), stopB = mbtaPlace(c.b.originStationId);
      if (ra === 'mbta' && stopA) {
        var r1 = nearest(await mbtaStopRows(stopA), trainNum(c.a), c.schedArr, 'arr');
        if (r1 && isFinite(r1.arr || r1.dep)) { out.inArr = r1.arr || r1.dep; out.inLive = true; }
      }
      if (rb === 'mbta' && stopB) {
        var r2 = nearest(await mbtaStopRows(stopB), trainNum(c.b), c.schedDep, 'dep');
        if (r2) { out.headsign = r2.headsign; out.dir = r2.dir; out.route = r2.route; out.outCancelled = r2.cancelled;
          if (isFinite(r2.dep)) { out.outDep = r2.dep; out.outLive = true; } }
      }
    }
    if (out.inArr == null && (ra === 'amtrak' || ra === 'ctrail')) {
      var x = amtrakStop(c.a, c.a.destStationId, c.schedArr, 'arr'); if (x) { out.inArr = x.t; out.inLive = true; }
    }
    if (out.outDep == null && (rb === 'amtrak' || rb === 'ctrail')) {
      var y = amtrakStop(c.b, c.b.originStationId, c.schedDep, 'dep'); if (y) { out.outDep = y.t; out.outLive = true; }
    }
    if (out.inArr == null) { var d1 = liveDelay(c.a); if (d1 != null) { out.inArr = c.schedArr + Math.max(0, d1) * 60000; out.inLive = true; } }
    if (out.outDep == null) { var d2 = liveDelay(c.b); if (d2 != null) { out.outDep = c.schedDep + Math.max(0, d2) * 60000; out.outLive = true; } }
    return out;
  }

  /* Next option (MBTA only, from the MBTA schedule): the next train on the same line and direction that
     leaves the change station after the rider can make it and is scheduled to stop at their destination. */
  async function nextOption(c, live, readyAt) {
    if (window.rrConn.testNext) return window.rrConn.testNext(c, live, readyAt);
    if (rrOf(c.b) !== 'mbta') return null;
    var key = c.b.trainNumber + '|' + c.b.originStationId + '|' + Math.round(readyAt / 300000);
    var hit = nextCache[key]; if (hit && Date.now() - hit.at < 5 * 60000) return hit.value;
    var value = null;
    try {
      var stop = mbtaPlace(c.b.originStationId), dest = mbtaPlace(c.b.destStationId), route = String(c.b.lineId || live.route || '');
      if (stop && dest && /^CR-/.test(route)) {
        var d = new Date(c.schedDep);
        var date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var from = new Date(c.schedDep - 60000);
        var hhmm = String(from.getHours()).padStart(2, '0') + ':' + String(from.getMinutes()).padStart(2, '0');
        var url = API + '/api/mbta/schedules?filter[stop]=' + encodeURIComponent(stop) + '&filter[route]=' + encodeURIComponent(route) +
          '&filter[date]=' + date + '&filter[min_time]=' + hhmm + '&include=trip&sort=departure_time&page[limit]=12';
        var j = await (await fetch(url)).json();
        var inc = {}; (j.included || []).forEach(function (x) { inc[x.type + ':' + x.id] = x; });
        var rows = (j.data || []).map(function (s) {
          var tr = s.relationships && s.relationships.trip && s.relationships.trip.data ? inc['trip:' + s.relationships.trip.data.id] : null;
          return { dep: ms(s.attributes.departure_time), tripId: tr ? tr.id : '', name: tr ? String(tr.attributes.name || '') : '', dir: tr ? tr.attributes.direction_id : null, headsign: tr ? tr.attributes.headsign : '' };
        }).filter(function (r) { return isFinite(r.dep); });
        var mine = rows.filter(function (r) { return r.name === trainNum(c.b); })[0];
        var dir = mine ? mine.dir : live.dir;
        if (dir != null) {
          var cands = rows.filter(function (r) { return r.dir === dir && r.name !== trainNum(c.b) && r.dep >= readyAt; });
          for (var i = 0; i < cands.length && i < 2 && !value; i++) {
            var chk = await (await fetch(API + '/api/mbta/schedules?filter[trip]=' + encodeURIComponent(cands[i].tripId) + '&filter[stop]=' + encodeURIComponent(dest) + '&page[limit]=1')).json();
            var s0 = chk && chk.data && chk.data[0];
            if (s0 && ms(s0.attributes.arrival_time || s0.attributes.departure_time) > cands[i].dep) value = { train: cands[i].name, dep: cands[i].dep, headsign: cands[i].headsign };
          }
        }
      }
    } catch (_) { value = null; }
    nextCache[key] = { at: Date.now(), value: value };
    return value;
  }

  /* ---------- assessment ---------- */
  function assess(c, live, now) {
    var arr = live.inArr != null ? live.inArr : c.schedArr;
    var dep = live.outDep != null ? live.outDep : c.schedDep;
    var buffer = Math.round((dep - arr) / 60000);
    var planned = Math.round((c.schedDep - c.schedArr) / 60000);
    var outLate = live.outDep != null ? Math.round((live.outDep - c.schedDep) / 60000) : 0;
    var level = live.outCancelled ? 'risk' : buffer >= c.min ? 'ok' : buffer >= 0 ? 'tight' : 'risk';
    var hasLive = !!(live.inLive || live.outLive);
    var label = trainLabel(c.b, live.headsign);
    var where = c.walk && c.toStation ? c.station + ' (then on to ' + c.toStation + ')' : c.station;
    var text;
    if (live.outCancelled) text = 'Your connecting train is cancelled. ' + cap(label) + ' won\u2019t leave ' + (c.toStation || c.station) + '.';
    else if (level === 'ok') text = 'Your connection at ' + where + ' looks good: ' + minutes(buffer) + ' to catch ' + label + '.';
    else if (level === 'tight') text = 'Your connection at ' + where + ' is tight: ' + minutes(buffer) + ' to catch ' + label + '.';
    else text = 'You\u2019ll likely miss your connection at ' + where + '. ' + cap(label) + ' leaves at ' + fmtTime(dep) + ', about ' + minutes(buffer) + ' before you get there.';
    var note = '';
    if (!live.outCancelled && outLate >= 3 && level !== 'risk') note = cap(trainLabel(c.b, live.headsign).replace(/ to .*$/, '')) + ' is running ' + minutes(outLate) + ' late too, which gives you more time.';
    else if (!hasLive && level !== 'ok') note = 'This is from the schedule. It\u2019s tight even if both trains run on time.';
    else if (!hasLive) note = 'From the schedule. We\u2019ll update this with live times closer to your trip.';
    return { key: c.i, level: level, buffer: buffer, planned: planned, min: c.min, arr: arr, dep: dep, live: hasLive, text: text, note: note, station: c.station };
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  async function assessTrip(data, now) {
    var out = [];
    var conns = connectionsOf(data);
    for (var k = 0; k < conns.length; k++) {
      var c = conns[k];
      if (now > c.schedDep + WINDOW_AFTER_MS + 60 * 60000) continue;      // long gone
      if (c.schedDep - now > 24 * 3600000) continue;                       // more than a day out: nothing to say yet
      var inWindow = c.schedDep - now <= WINDOW_BEFORE_MS;
      var live = inWindow ? await liveTimes(c) : { inArr: null, outDep: null };
      var r = assess(c, live, now);
      if (now > r.dep + WINDOW_AFTER_MS) continue;                         // connecting train has left
      if (r.level === 'risk' && !live.outCancelled) {
        var nx = await nextOption(c, live, r.arr + c.min * 60000);
        if (nx) r.next = 'Next option: ' + trainLabel(Object.assign({}, c.b, { trainNumber: nx.train }), nx.headsign) + ' at ' + fmtTime(nx.dep) + '.';
      }
      if (r.level === 'ok' && !inWindow) continue;                        // calm and far off: keep the card quiet
      out.push(r);
    }
    return out;
  }

  /* ---------- painting ---------- */
  var PILL = { ok: 'Connection OK', tight: 'Tight connection', risk: 'Connection at risk' };
  function blockHtml(r) {
    return '<div class="trip-conn" data-level="' + r.level + '" role="status">' +
      '<span class="trip-conn-pill">' + PILL[r.level] + '</span>' +
      '<span class="trip-conn-text">' + esc(r.text) + '</span>' +
      (r.next ? '<span class="trip-conn-next">' + esc(r.next) + '</span>' : '') +
      (r.note ? '<span class="trip-conn-note">' + esc(r.note) + '</span>' : '') +
    '</div>';
  }
  function paintCard(row, list) {
    var box = row.querySelector('.trip-conn-wrap');
    if (!list.length) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.className = 'trip-conn-wrap';
      var anchor = row.querySelector('.trip-log-row-map') || null;
      row.insertBefore(box, anchor);
    }
    var html = list.map(blockHtml).join('');
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  function paintDetail(list) {
    var live = document.getElementById('trip-detail-live');
    var box = document.getElementById('trip-detail-conn');
    if (!list || !list.length) { if (box) box.remove(); return; }
    if (!box && live && live.parentNode) {
      box = document.createElement('div'); box.id = 'trip-detail-conn'; box.className = 'trip-conn-wrap is-detail';
      live.parentNode.insertBefore(box, live.nextSibling);
    }
    if (box) { var html = list.map(blockHtml).join(''); if (box.innerHTML !== html) box.innerHTML = html; }
  }
  function injectStyle() {
    if (document.getElementById('trip-conn-style')) return;
    var st = document.createElement('style'); st.id = 'trip-conn-style';
    st.textContent =
      '.trip-conn-wrap{display:flex;flex-direction:column;gap:6px;margin:8px 0 10px}' +
      // Cards are a grid with named areas; give the warning its own row right under the live line.
      'html.rr-mytrips-page .trip-log-row,html.rr-mytrips-page .trip-log-row[data-rail-accent]{grid-template-areas:"top map" "route map" "meta map" "facts map" "live map" "actual map" "conn map" "actions map";grid-template-rows:auto auto auto auto auto auto auto 1fr}' +
      'html.rr-mytrips-page .trip-log-row>.trip-conn-wrap{grid-area:conn;min-width:0}' +
      '@media (max-width:640px){html.rr-mytrips-page .trip-log-row,html.rr-mytrips-page .trip-log-row[data-rail-accent]{grid-template-areas:"top" "route" "meta" "facts" "live" "actual" "conn" "map" "actions";grid-template-rows:none}}' +
      '.trip-conn{display:flex;flex-direction:column;align-items:flex-start;gap:4px;background:#fff;color:#07093e;border-radius:4px;border-left:4px solid var(--conn,#0ac700);padding:8px 10px;font-size:13px;line-height:1.4;text-align:left}' +
      '.trip-conn[data-level="ok"]{--conn:#0ac700}.trip-conn[data-level="tight"]{--conn:#ffb020}.trip-conn[data-level="risk"]{--conn:#e5484d}' +
      '.trip-conn-pill{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-weight:700;font-size:11.5px;background:var(--conn);color:#07093e;white-space:nowrap}' +
      '.trip-conn[data-level="risk"] .trip-conn-pill{color:#fff}' +
      '.trip-conn-text{font-weight:700}.trip-conn-next{font-weight:700;color:#07093e}.trip-conn-note{color:#4a5270;font-size:12px}' +
      '.trip-conn-wrap.is-detail{margin:6px 0 12px}.trip-conn-wrap.is-detail .trip-conn{font-size:14px;border:1px solid #e3e6eb;border-left-width:4px}';
    document.head.appendChild(st);
  }

  var running = false, again = false;
  async function refresh() {
    if (running) { again = true; return; }
    running = true;
    try {
      injectStyle();
      var now = window.rrConn.testNow ? window.rrConn.testNow() : Date.now();
      var rows = document.querySelectorAll('#trip-log-list .trip-log-row[data-trip-id]');
      for (var i = 0; i < rows.length; i++) {
        var id = rows[i].getAttribute('data-trip-id');
        var data = window.rrTripLogDataFor ? window.rrTripLogDataFor(id) : null;
        if (!data || !Array.isArray(data.segments) || data.segments.length < 2) { paintCard(rows[i], []); continue; }
        var list = await assessTrip(data, now);
        results[id] = list;
        paintCard(rows[i], list);
      }
      var open = window.rrTripDetailOpenTrip ? window.rrTripDetailOpenTrip() : null;
      if (open && open.data) paintDetail(results[open.id] || await assessTrip(open.data, now));
      else paintDetail(null);
    } catch (e) { console.warn('[trip-connections]', e); }
    running = false;
    if (again) { again = false; setTimeout(refresh, 0); }
  }
  function start() {
    if (timer) return;
    timer = setInterval(function () { if (document.visibilityState !== 'hidden') refresh(); }, POLL_MS);
  }
  window.rrConn = { refresh: refresh, assess: assess, connectionsOf: connectionsOf, minTransfer: minTransfer, results: results };
  window.rrConnRefresh = function () { start(); setTimeout(refresh, 50); };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && timer) refresh(); });
})();
