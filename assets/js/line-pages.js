/* Live parts of the /lines/ and /stations/ pages: trains on the line, delays and alerts, upcoming departures at a station,
   and RailroadRadar's own delay history. The station lists and facts are already in the page HTML; this only adds live data.
   Everything here reads the same Worker endpoints the Live Map uses. Any part that fails to load says so or hides itself,
   and never shows a guessed number. */
(function () {
  var main = document.getElementById('lp-main');
  if (!main) return;
  var API = String(window.RR_TRIP_API_BASE || 'https://railroadradar-proxy.railroadradar.workers.dev').replace(/\/+$/, '');
  var HISTORY = 'https://railroadradar-history.railroadradar.workers.dev';
  var D = main.dataset;
  var RR = D.rr;
  var ROUTES = String(D.route || '').split(',').filter(Boolean);
  var INFO_EFFECTS = { STATION_ISSUE: 1, NOTICE: 1, ACCESS_ISSUE: 1, ELEVATOR_CLOSURE: 1, ESCALATOR_CLOSURE: 1, PARKING_CLOSURE: 1, PARKING_ISSUE: 1,
    FACILITY_ISSUE: 1, BIKE_ISSUE: 1, AMBER_ALERT: 1, POLICE_ACTIVITY: 0, OTHER_EFFECT: 1, UNKNOWN_EFFECT: 1, STOP_MOVE: 1 };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function msg(el, text) { if (el) el.innerHTML = '<p class="lp-msg">' + esc(text) + '</p>'; }
  function hide(id) { var el = $(id); if (el) el.hidden = true; }
  function show(id) { var el = $(id); if (el) el.hidden = false; }
  function getJson(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }
  function getBytes(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); });
  }
  function clock(ms) {
    return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: RR_TZ() });
  }
  function RR_TZ() { return RR === 'metra' ? 'America/Chicago' : 'America/New_York'; }
  function pill(delayMin) {
    if (delayMin == null || isNaN(delayMin)) return '';
    var d = Math.round(delayMin);
    if (d <= 1) return '<span class="lp-pill ok">On Time</span>';
    return '<span class="lp-pill' + (d > 5 ? ' late' : '') + '">' + d + ' Min Late</span>';
  }
  function mapLink(num, label) {
    return num ? '<a href="/map/?focus=' + encodeURIComponent(RR + ':' + num) + '">' + esc(label) + '</a>' : esc(label);
  }
  function rows(el, items, empty) {
    if (!el) return;
    if (!items.length) { msg(el, empty); return; }
    el.innerHTML = '<ul class="lp-rows">' + items.join('') + '</ul>';
  }
  /* Some feeds put HTML in alert text; show it as plain text. DOMParser builds an inert document, so nothing in it runs. */
  function plain(t) {
    t = String(t || '');
    if (!/[<&]/.test(t)) return t.trim();
    try { return (new DOMParser().parseFromString(t, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch (_) { return t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  }
  function alertsOut(list) {
    var el = $('lp-alerts');
    if (!el) return;
    if (!list.length) { msg(el, 'No current alerts for this line.'); return; }
    el.innerHTML = list.slice(0, 6).map(function (t) { return '<p class="lp-alert">' + esc(t) + '</p>'; }).join('');
  }

  /* ---------- a small GTFS-realtime protobuf reader (only the fields used here) ---------- */
  function pb(buf, start, end) {
    var pos = start, out = [];
    /* A negative int32 arrives as a 10 byte varint; read it from its low 32 bits, and give up on anything that is not a sign-extended int32. */
    function varint() {
      var v = 0, mul = 1, b, lo = 0, n = 0;
      do { b = buf[pos++]; if (n < 5) lo += (b & 127) * Math.pow(2, 7 * n); v += (b & 127) * mul; mul *= 128; n++; } while (b & 128 && pos < end);
      if (n < 10) return v;
      lo = lo % 4294967296;
      return lo >= 2147483648 ? lo - 4294967296 : NaN;
    }
    while (pos < end) {
      var tag = varint(), field = Math.floor(tag / 8), wt = tag & 7;
      if (wt === 0) out.push([field, varint()]);
      else if (wt === 2) { var len = varint(); out.push([field, [pos, pos + len]]); pos += len; }
      else if (wt === 1) pos += 8;
      else if (wt === 5) { if (!buf._dv) buf._dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); out.push([field, { f: buf._dv.getFloat32(pos, true) }]); pos += 4; }
      else break;
    }
    return out;
  }
  var utf8 = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  function str(buf, r) { return utf8 ? utf8.decode(buf.subarray(r[0], r[1])) : ''; }
  function sint32(v) { return v > 2147483647 ? v - 4294967296 : (v >= 4294967296 ? v - 18446744073709551616 : v); }
  function each(buf, r, fn) { pb(buf, r[0], r[1]).forEach(function (f) { fn(f[0], f[1]); }); }
  function trip(buf, r) { var t = {}; each(buf, r, function (k, v) { if (k === 1) t.trip_id = str(buf, v); else if (k === 5) t.route_id = str(buf, v); }); return t; }
  function vdesc(buf, r) { var t = {}; each(buf, r, function (k, v) { if (k === 1) t.id = str(buf, v); else if (k === 2) t.label = str(buf, v); }); return t; }
  function tstring(buf, r) {
    var best = '';
    each(buf, r, function (k, v) {
      if (k !== 1) return;
      var text = '', lang = '';
      each(buf, v, function (k2, v2) { if (k2 === 1) text = str(buf, v2); else if (k2 === 2) lang = str(buf, v2); });
      if (!best || /^en/i.test(lang)) best = text;
    });
    return plain(best);
  }
  function okDelay(v) { v = sint32(v); return isFinite(v) && Math.abs(v) < 86400 ? v : null; }
  function stEvent(buf, r) { var e = {}; each(buf, r, function (k, v) { if (k === 1) { if (okDelay(v) != null) e.delay = okDelay(v); } else if (k === 2) e.time = v; }); return e; }
  function feed(buf) {
    var ents = [];
    pb(buf, 0, buf.length).forEach(function (f) {
      if (f[0] !== 2 || typeof f[1] === 'number') return;
      var e = {};
      each(buf, f[1], function (k, v) {
        if (k === 3) {
          var tu = { stu: [] };
          each(buf, v, function (k2, v2) {
            if (k2 === 1) tu.trip = trip(buf, v2);
            else if (k2 === 3) tu.vehicle = vdesc(buf, v2);
            else if (k2 === 5 && okDelay(v2) != null) tu.delay = okDelay(v2);
            else if (k2 === 2) {
              var s = {};
              each(buf, v2, function (k3, v3) {
                if (k3 === 4) s.stop_id = str(buf, v3);
                else if (k3 === 2) s.arrival = stEvent(buf, v3);
                else if (k3 === 3) s.departure = stEvent(buf, v3);
                else if (k3 === 5) s.skipped = v3 === 1;
              });
              tu.stu.push(s);
            }
          });
          e.trip_update = tu;
        } else if (k === 4) {
          var vp = {};
          each(buf, v, function (k2, v2) {
            if (k2 === 1) vp.trip = trip(buf, v2);
            else if (k2 === 8) vp.vehicle = vdesc(buf, v2);
            else if (k2 === 7) vp.stop_id = str(buf, v2);
            else if (k2 === 2) { var q = {}; each(buf, v2, function (k3, v3) { if (k3 === 1 && v3.f != null) q.lat = v3.f; else if (k3 === 2 && v3.f != null) q.lon = v3.f; }); if (q.lat && q.lon) vp.pos = q; }
          });
          e.vehicle = vp;
        } else if (k === 5) {
          var a = { periods: [], ents: [] };
          each(buf, v, function (k2, v2) {
            if (k2 === 1) { var p = {}; each(buf, v2, function (k3, v3) { if (k3 === 1) p.start = v3; else if (k3 === 2) p.end = v3; }); a.periods.push(p); }
            else if (k2 === 5) { var s = {}; each(buf, v2, function (k3, v3) { if (k3 === 1) s.agency_id = str(buf, v3); else if (k3 === 2) s.route_id = str(buf, v3); else if (k3 === 4) s.trip = trip(buf, v3); }); a.ents.push(s); }
            else if (k2 === 10) a.header = tstring(buf, v2);
          });
          e.alert = a;
        }
      });
      ents.push(e);
    });
    return ents;
  }
  function alertActive(a) {
    if (!a.periods.length) return true;
    var now = Date.now() / 1000;
    return a.periods.some(function (p) { return (!p.start || p.start <= now) && (!p.end || p.end >= now); });
  }
  function rtAlerts(url, agencies) {
    return getBytes(url).then(function (buf) {
      var seen = {}, out = [];
      feed(buf).forEach(function (e) {
        var a = e.alert;
        if (!a || !a.header || !alertActive(a)) return;
        var hit = a.ents.some(function (s) {
          var rid = s.route_id || (s.trip && s.trip.route_id) || '';
          return ROUTES.indexOf(rid) >= 0 && (!agencies || !s.agency_id || agencies.indexOf(String(s.agency_id).toUpperCase()) >= 0);
        });
        if (hit && !seen[a.header]) { seen[a.header] = 1; out.push(a.header); }
      });
      return out;
    });
  }
  function stopNames() {
    try { return JSON.parse(($('lp-stop-names') || {}).textContent || '{}'); } catch (_) { return {}; }
  }

  /* ---------- MBTA ---------- */
  function mbta(path) { return getJson(API + '/api/mbta/' + path); }
  function inc(d) {
    var m = {};
    (d.included || []).forEach(function (x) { m[x.type + ':' + x.id] = x; });
    return function (rel) { return rel && rel.data ? m[rel.data.type + ':' + rel.data.id] : null; };
  }
  function mbtaLine(onlyMap) {
    var r = encodeURIComponent(ROUTES.join(','));
    if (!r) return;
    Promise.all([
      mbta('vehicles?filter[route]=' + r + '&include=trip,stop'),
      mbta('predictions?filter[route]=' + r + '&include=schedule').catch(function () { return null; })
    ]).then(function (res) {
      var v = res[0], find = inc(v), delays = {};
      if (res[1]) {
        var findS = inc(res[1]), firstSeq = {};
        (res[1].data || []).forEach(function (p) {
          var tid = p.relationships && p.relationships.trip && p.relationships.trip.data && p.relationships.trip.data.id;
          var s = findS(p.relationships && p.relationships.schedule);
          if (!tid || !s) return;
          var pt = p.attributes.departure_time || p.attributes.arrival_time, st = s.attributes.departure_time || s.attributes.arrival_time;
          if (!pt || !st) return;
          var seq = p.attributes.stop_sequence || 0;
          if (firstSeq[tid] != null && firstSeq[tid] <= seq) return;
          firstSeq[tid] = seq;
          delays[tid] = (Date.parse(pt) - Date.parse(st)) / 60000;
        });
      }
      var pins = [];
      var list = (v.data || []).map(function (x) {
        var t = find(x.relationships.trip), s = find(x.relationships.stop);
        var num = t && t.attributes.name, head = t && t.attributes.headsign;
        if (x.attributes.latitude != null) pins.push({ lat: x.attributes.latitude, lon: x.attributes.longitude, num: num || x.attributes.label || '', to: head, delay: t ? delays[t.id] : null });
        var where = s ? ({ STOPPED_AT: 'At ', INCOMING_AT: 'Arriving at ' }[x.attributes.current_status] || 'Heading to ') + s.attributes.name : '';
        return { num: num || '', html: '<li><b>' + mapLink(num, 'Train ' + (num || x.attributes.label || '')) + (head ? ' to ' + esc(head) : '') + '</b><span>' + esc(where) + ' ' + pill(t ? delays[t.id] : null) + '</span></li>' };
      }).sort(function (a, b) { return Number(a.num) - Number(b.num); });
      if (!onlyMap) rows($('lp-live'), list.map(function (x) { return x.html; }), 'No trains are running on this line right now.');
      mapTrains(pins);
    }).catch(function () { if (!onlyMap) msg($('lp-live'), 'Live trains are not available right now. Try the Live Map.'); });
  }
  function mbtaAlerts() {
    var r = encodeURIComponent(ROUTES.join(','));
    mbta('alerts?filter[route]=' + r + '&filter[datetime]=NOW').then(function (d) {
      var seen = {}, out = [];
      (d.data || []).forEach(function (a) {
        var t = a.attributes.short_header || a.attributes.header;
        if (!t || INFO_EFFECTS[a.attributes.effect] || seen[t]) return;
        seen[t] = 1; out.push(t);
      });
      alertsOut(out);
    }).catch(function () { msg($('lp-alerts'), 'Alerts are not available right now.'); });
  }
  function nyDate(ms) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }
  function depRow(time, route, trip, delay, note) {
    var num = trip && trip.attributes.name;
    var line = route ? String(route.attributes.long_name || '').replace(/ Line$/, '') : '';
    return '<li><b>' + esc(clock(time)) + ' ' + mapLink(num, num ? 'Train ' + num : 'Train') + (trip && trip.attributes.headsign ? ' to ' + esc(trip.attributes.headsign) : '') + '</b><span>' + esc(line) + ' ' + (note || pill(delay)) + '</span></li>';
  }
  function mbtaStation() {
    var stop = encodeURIComponent(D.stop), el = $('lp-departures'), now = Date.now();
    mbta('predictions?filter[stop]=' + stop + '&filter[route_type]=2&include=trip,schedule,route&sort=departure_time').then(function (d) {
      var find = inc(d);
      var list = (d.data || []).filter(function (p) {
        var t = Date.parse(p.attributes.departure_time || '');
        return t && t >= now - 60000 && p.attributes.schedule_relationship !== 'SKIPPED' && p.attributes.schedule_relationship !== 'CANCELLED';
      }).slice(0, 8).map(function (p) {
        var s = find(p.relationships.schedule), t = Date.parse(p.attributes.departure_time);
        var st = s && Date.parse(s.attributes.departure_time || '');
        return depRow(t, find(p.relationships.route), find(p.relationships.trip), st ? (t - st) / 60000 : null);
      });
      if (list.length) { rows(el, list, ''); return; }
      throw new Error('none');
    }).catch(function () {
      var n = nyDate(now);
      return mbta('schedules?filter[stop]=' + stop + '&filter[route_type]=2&filter[date]=' + n.date + '&filter[min_time]=' + n.time + '&include=trip,route&sort=departure_time&page[limit]=12').then(function (d) {
        var find = inc(d);
        var list = (d.data || []).filter(function (s) { return s.attributes.departure_time && s.attributes.pickup_type !== 1; }).slice(0, 8).map(function (s) {
          return depRow(Date.parse(s.attributes.departure_time), find(s.relationships.route), find(s.relationships.trip), null, '<span class="lp-pill">Scheduled</span>');
        });
        rows(el, list, 'No more Commuter Rail departures from this station today.');
      });
    }).catch(function () { msg(el, 'Departures are not available right now. Try the Live Map.'); });
  }

  /* ---------- Amtrak (Amtraker JSON through the Worker) ---------- */
  function amtrakTrains() {
    return getJson(API + '/api/amtrak/trains').then(function (d) {
      var out = [];
      Object.keys(d || {}).forEach(function (k) { (d[k] || []).forEach(function (t) { if (t && t.stations) out.push(t); }); });
      return out;
    });
  }
  function amtrakDelay(t) {
    var st = t.stations || [], last = null;
    for (var i = 0; i < st.length; i++) if (st[i].status === 'Departed') last = st[i];
    if (last && last.dep && last.schDep) return (Date.parse(last.dep) - Date.parse(last.schDep)) / 60000;
    var next = st.filter(function (s) { return s.status === 'Enroute' || s.status === 'Station'; })[0];
    if (next && next.arr && next.schArr) return (Date.parse(next.arr) - Date.parse(next.schArr)) / 60000;
    return null;
  }
  function sameRoute(a, b) {
    a = String(a || '').toLowerCase().replace(/^amtrak\s+/, ''); b = String(b || '').toLowerCase().replace(/^amtrak\s+/, '');
    return !!a && !!b && (a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0);
  }
  function amtrakLine(onlyMap, names) {
    names = names || [D.name];
    amtrakTrains().then(function (all) {
      var mine = all.filter(function (t) { return t.trainState === 'Active' && names.some(function (n) { return sameRoute(t.routeName, n); }); });
      mapTrains(mine.filter(function (t) { return t.lat != null && t.lon != null; }).map(function (t) { return { rr: 'amtrak', lat: t.lat, lon: t.lon, num: t.trainNum, to: t.destName, delay: amtrakDelay(t), route: t.routeName }; }), 'amtrak');
      if (onlyMap) return;
      var list = mine
        .sort(function (a, b) { return Number(a.trainNum) - Number(b.trainNum); })
        .map(function (t) {
          var next = (t.stations || []).filter(function (s) { return s.status === 'Enroute' || s.status === 'Station'; })[0];
          return '<li><b>' + mapLink(t.trainNum, 'Train ' + t.trainNum) + ' to ' + esc(t.destName) + '</b><span>' + (next ? 'Next: ' + esc(next.name) + ' ' : '') + pill(amtrakDelay(t)) + '</span></li>';
        });
      rows($('lp-live'), list, 'No trains are running on this route right now.');
    }).catch(function () { if (!onlyMap) msg($('lp-live'), 'Live trains are not available right now. Try the Live Map.'); });
  }
  function amtrakAlerts() {
    rtAlerts(API + '/api/amtrak/alerts', null).then(alertsOut).catch(function () { msg($('lp-alerts'), 'Alerts are not available right now.'); });
  }
  function amtrakAtStation() {
    var codes = String(D.amtrak || '').split(',').filter(Boolean);
    if (!codes.length || !$('lp-amtrak')) return;
    amtrakTrains().then(function (all) {
      var now = Date.now(), list = [];
      all.forEach(function (t) {
        if (t.trainState !== 'Active') return;
        (t.stations || []).forEach(function (s) {
          if (codes.indexOf(s.code) < 0 || (s.status !== 'Enroute' && s.status !== 'Station')) return;
          var at = Date.parse(s.dep || s.arr || '');
          if (!at || at < now - 5 * 60000 || at > now + 6 * 3600000) return;
          var late = s.dep && s.schDep ? (Date.parse(s.dep) - Date.parse(s.schDep)) / 60000 : (s.arr && s.schArr ? (Date.parse(s.arr) - Date.parse(s.schArr)) / 60000 : null);
          list.push({ at: at, html: '<li><b>' + esc(clock(at)) + ' <a href="/map/?focus=' + encodeURIComponent('amtrak:' + t.trainNum) + '">' + esc(t.routeName + ' ' + t.trainNum) + '</a> to ' + esc(t.destName) + '</b><span>' + pill(late) + '</span></li>' });
        });
      });
      if (!list.length) return;
      list.sort(function (a, b) { return a.at - b.at; });
      rows($('lp-amtrak'), list.slice(0, 8).map(function (x) { return x.html; }), '');
      show('amtrak');
    }).catch(function () {});
  }

  /* ---------- Metro-North, LIRR and Metra (GTFS-realtime through the Worker) ---------- */
  function rtLine(tripUrl, vehicleUrl, onlyMap) {
    var names = stopNames();
    Promise.all([getBytes(tripUrl), vehicleUrl ? getBytes(vehicleUrl).catch(function () { return null; }) : Promise.resolve(null)]).then(function (res) {
      var ents = feed(res[0]).concat(res[1] ? feed(res[1]) : []);
      var running = {}, labels = {}, upd = {}, where = {}, rids = {};
      var now = Date.now() / 1000;
      ents.forEach(function (e) { if (e.trip_update && e.trip_update.trip && e.trip_update.trip.trip_id) upd[e.trip_update.trip.trip_id] = e.trip_update; });
      /* Some feeds name the route only on the trip update, so a train counts when either one is on this line and its trip is under way. */
      function evTime(s) { var ev = s && (s.departure || s.arrival); return ev && ev.time ? ev.time : null; }
      ents.forEach(function (e) {
        var id = e.vehicle && e.vehicle.trip && e.vehicle.trip.trip_id;
        if (!id) return;
        /* Metro-North sends the vehicle and its trip update in one entity, under different trip ids. */
        var tu = e.trip_update || upd[id], rid = e.vehicle.trip.route_id || (tu && tu.trip && tu.trip.route_id) || '';
        if (e.trip_update) upd[id] = e.trip_update;
        if (ROUTES.indexOf(rid) < 0) return;
        if (tu && tu.stu.length) {
          var t0 = evTime(tu.stu[0]), t1 = evTime(tu.stu[tu.stu.length - 1]);
          if ((t0 && t0 > now + 300) || (t1 && t1 < now - 600)) return;
        }
        running[id] = 1; rids[id] = rid;
        if (e.vehicle.pos) where[id] = e.vehicle.pos;
        if (e.vehicle.vehicle && e.vehicle.vehicle.label) labels[id] = e.vehicle.vehicle.label;
      });
      var list = Object.keys(running).map(function (id) {
        var tu = upd[id], num = labels[id] || (tu && tu.vehicle && tu.vehicle.label) || '', delay = null, next = '', last = '';
        if (!num && /^\d{1,5}$/.test(id)) num = id;
        if (tu) {
          var ahead = tu.stu.filter(function (s) { var ev = s.departure || s.arrival; return !s.skipped && (!ev || !ev.time || ev.time >= now - 60); });
          var s0 = ahead[0];
          if (s0) {
            next = names[s0.stop_id] || '';
            var ev = (s0.arrival && s0.arrival.delay != null) ? s0.arrival : s0.departure;
            if (ev && ev.delay != null) delay = ev.delay / 60;
          }
          if (delay == null && tu.delay != null) delay = tu.delay / 60;
          var end = tu.stu[tu.stu.length - 1];
          last = end ? names[end.stop_id] || '' : '';
        }
        return { num: num, pin: where[id] ? { lat: where[id].lat, lon: where[id].lon, num: num, to: last, delay: delay, route: rids[id] } : null, html: '<li><b>' + mapLink(num, num ? 'Train ' + num : 'Train') + (last ? ' to ' + esc(last) : '') + '</b><span>' + (next ? 'Next: ' + esc(next) + ' ' : '') + pill(delay) + '</span></li>' };
      }).sort(function (a, b) { return (Number(a.num) || 0) - (Number(b.num) || 0); });
      mapTrains(list.map(function (x) { return x.pin; }).filter(Boolean));
      if (!onlyMap) rows($('lp-live'), list.map(function (x) { return x.html; }), 'No trains are running on this line right now.');
    }).catch(function () { if (!onlyMap) msg($('lp-live'), 'Live trains are not available right now. Try the Live Map.'); });
  }

  /* ---------- RailroadRadar's own delay history ---------- */
  function histDate(s) {
    var d = new Date(String(s) + 'T12:00:00Z');
    return isNaN(d) ? String(s) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function history() {
    var key = String(D.history || '').toLowerCase();
    if (!key || !$('history')) return;
    getJson(HISTORY + '/api/history/lines?rr=' + encodeURIComponent(RR) + '&line=' + encodeURIComponent(key)).then(function (d) {
      if (!d || !d.ok || d.insufficient) return;
      var row = (d.lines || []).filter(function (x) { var n = String(x.line || '').toLowerCase(); return n === key || n.indexOf(key) >= 0; })[0];
      if (!row || row.insufficient || !(row.n >= 5) || row.on_time_pct == null) return;
      var range = d.from && d.to ? (d.from === d.to ? 'On ' + histDate(d.from) : 'From ' + histDate(d.from) + ' to ' + histDate(d.to)) : '';
      $('lp-history-range').textContent = range ? range + ', ' + row.n + ' recorded runs.' : row.n + ' recorded runs.';
      var stats = [[row.on_time_pct + '%', 'On Time'], [row.avg_delay + ' min', 'Average Delay']];
      if (row.late15_pct != null) stats.push([row.late15_pct + '%', 'More Than 15 Min Late']);
      stats.push([String(row.n), 'Runs Recorded']);
      $('lp-history').innerHTML = '<div class="lp-stats">' + stats.map(function (s) { return '<div><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('') + '</div>';
      show('history');
    }).catch(function () {});
  }

  /* ---------- the page's map: the route, its stations and live trains, drawn with the same Leaflet, tiles and train icons as the Live Map ---------- */
  var M = { el: $('lp-map'), map: null, trains: {}, layer: null };
  function trainIcon(rr, t) {
    var url = rr === 'mbta' ? '/assets/hsp46.png'
      : rr === 'amtrak' ? (/acela/i.test(t.route || '') ? '/assets/amtrak-acela.png' : /empire service/i.test(t.route || '') ? '/assets/amtrak-empire.png' : /northeast regional|keystone/i.test(t.route || '') ? '/assets/amtrak-acs64.png' : '/assets/amtrak.png')
      : rr === 'mnr' ? (String(t.route) === '3' ? '/assets/mnr-new-haven.png' : '/assets/mnr.png')
      : rr === 'lirr' ? '/assets/lirr.png' : '';
    if (url) return L.icon({ iconUrl: url, iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -22], className: 'train-icon' });
    return L.divIcon({ className: 'metra-icon', html: '<div style="width:16px;height:16px;background:#0055A4;border:2px solid #ffffff;border-radius:50%;box-sizing:border-box;"></div>', iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] });
  }
  function drawTrains() {
    if (!M.map) return;
    if (M.layer) M.layer.clearLayers(); else M.layer = L.layerGroup().addTo(M.map);
    Object.keys(M.trains).forEach(function (rr) {
      M.trains[rr].forEach(function (t) {
        var num = t.num ? 'Train ' + t.num : 'Train';
        L.marker([t.lat, t.lon], { icon: trainIcon(rr, t), title: num, keyboard: false, zIndexOffset: 500 })
          .bindPopup('<b>' + esc(num) + '</b>' + (t.to ? ' to ' + esc(t.to) : '') + (pill(t.delay) ? '<br>' + pill(t.delay) : '') + (t.num ? '<br><a href="/map/?focus=' + encodeURIComponent(rr + ':' + t.num) + '">Open in the Live Map</a>' : ''))
          .addTo(M.layer);
      });
    });
  }
  function mapTrains(list, rr) { M.trains[rr || RR] = list || []; drawTrains(); }
  function mapData() { try { return JSON.parse(($('lp-map-data') || {}).textContent || 'null'); } catch (_) { return null; } }
  function buildMap() {
    var d = mapData();
    if (!d || !window.L || !M.el) return;
    M.el.innerHTML = '';
    var map = L.map(M.el, { scrollWheelZoom: false, zoomSnap: 0.5, attributionControl: true });
    L.tileLayer(API + '/api/mapbox/styles/v1/northeastamtrakrailfanalt/ckyq285h5219a14mpql9jt2r7/tiles/256/{z}/{x}/{y}', {
      attribution: '&copy; Mapbox &copy; OpenStreetMap contributors', maxZoom: 18, opacity: 1,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='
    }).addTo(map);
    var bounds = [];
    (d.lines || []).forEach(function (l) {
      (l.paths || []).forEach(function (p) { L.polyline(p, { color: l.color, weight: 5, opacity: 1, lineJoin: 'round', lineCap: 'round', interactive: false }).addTo(map); bounds = bounds.concat(p); });
    });
    var dot = (d.lines && d.lines[0] && d.lines[0].color) || '#07093e';
    (d.stops || []).forEach(function (s) {
      var m = L.circleMarker([s[0], s[1]], { radius: 5, color: dot, weight: 2.5, opacity: 1, fillColor: '#ffffff', fillOpacity: 1 }).addTo(map);
      m.bindTooltip(esc(s[2]), { direction: 'top', offset: [0, -4] });
      if (s[3]) m.on('click', function () { location.href = s[3]; });
      bounds.push([s[0], s[1]]);
    });
    if (d.here) {
      L.circleMarker([d.here[0], d.here[1]], { radius: 9, color: '#ffffff', weight: 3, opacity: 1, fillColor: dot, fillOpacity: 1 }).addTo(map)
        .bindTooltip(esc(d.here[2]), { permanent: true, direction: 'top', offset: [0, -8] });
    }
    if (d.center) map.setView(d.center, d.zoom || 13);
    else if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] });
    M.map = map;
    drawTrains();
  }
  function startMap() {
    if (!M.el) return;
    if (window.L) { buildMap(); return; }
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = buildMap;
    js.onerror = function () { msg(M.el, 'The map is not available right now. Try the Live Map.'); M.el.firstChild.className = 'lp-map-msg'; };
    document.head.appendChild(js);
  }
  /* The map loads after the page itself, and only once it is near the screen, so the text and links show first. */
  function lazyMap() {
    if (!M.el) return;
    if (!('IntersectionObserver' in window)) { startMap(); return; }
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); startMap(); } }, { rootMargin: '200px' });
    io.observe(M.el);
  }

  function trains(onlyMap) {
    if (D.page === 'station') {
      mbtaLine(true);
      var al = String(D.amtrakLines || '').split('|').filter(Boolean);
      if (al.length) amtrakLine(true, al);
      return;
    }
    if (RR === 'mbta') mbtaLine(onlyMap);
    else if (RR === 'amtrak') amtrakLine(onlyMap);
    else if (RR === 'mnr') rtLine(API + '/api/mta/mnr', null, onlyMap);
    else if (RR === 'lirr') rtLine(API + '/api/mta/lirr', null, onlyMap);
    else if (RR === 'metra') rtLine(API + '/api/metra/tripupdates', API + '/api/metra/positions', onlyMap);
  }
  function alertsOnce() {
    function fail() { msg($('lp-alerts'), 'Alerts are not available right now.'); }
    if (RR === 'mbta') mbtaAlerts();
    else if (RR === 'amtrak') amtrakAlerts();
    else if (RR === 'mnr') rtAlerts(API + '/api/mta/alerts', ['MNR']).then(alertsOut).catch(fail);
    else if (RR === 'lirr') rtAlerts(API + '/api/mta/alerts', ['LI', 'LIRR']).then(alertsOut).catch(fail);
    else if (RR === 'metra') rtAlerts(API + '/api/metra/alerts', null).then(alertsOut).catch(fail);
  }

  try {
    if (document.readyState === 'complete') lazyMap(); else window.addEventListener('load', lazyMap);
    if (D.page === 'station') { mbtaStation(); amtrakAtStation(); trains(true); }
    else { trains(false); alertsOnce(); history(); }
    /* Trains move, so the list and the map refresh every 30 seconds while the page is open. */
    setInterval(function () { if (!document.hidden) trains(D.page === 'station'); }, 30000);
  } catch (_) {}
})();
