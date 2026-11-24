/* Railside Live departure board.
   Live times refresh every 60s, and only for the railroads that serve the station on screen.
   Reported equipment is one cached trainReports read every 30 minutes (rr-fs-cache), never a listener. */
(function () {
  'use strict';
  var REFRESH_MS = 60 * 1000;
  var PAGE_MS = 10 * 1000;
  var REPORTS_TTL_MS = 60 * 1000;
  var HORIZON_MS = 8 * 60 * 60 * 1000;
  var API = 'https://railroadradar-proxy.railroadradar.workers.dev';
  var AGENCY_LABEL = { mbta: 'MBTA', amtrak: 'Amtrak', mnr: 'Metro-North', lirr: 'LIRR', njt: 'NJ Transit', marc: 'MARC', ctrail: 'CTrail', via: 'VIA', brightline: 'Brightline' };
  var RANK = { mbta: 0, lirr: 1, mnr: 2, njt: 3, marc: 4, ctrail: 5, brightline: 6, via: 7, amtrak: 8 };
  var extra = window.RR_BOARD_EXTRA || { lirr: { stops: [], routes: {} }, marc: { stops: [], routes: {} }, mnrRoutes: {} };
  var feedCache = Object.create(null);
  var hubs = [];
  var current = null;
  var timer = 0;
  var pageTimer = 0;
  var loading = false;
  var boardList = [];
  var pageIndex = 0;
  var fading = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function titleCase(x) {
    var v = String(x || '').replace(/\s+/g, ' ').trim();
    if (!v) return '';
    if (v !== v.toUpperCase() && v !== v.toLowerCase()) return v;
    return v.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function clock(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(d);
  }
  function fmtDelay(min) {
    var n = Math.round(Number(min) || 0), a = Math.abs(n);
    if (a < 60) return n + ' min';
    var h = Math.floor(a / 60), m = a % 60;
    return h + ' Hr' + (m ? ' ' + m + ' Min' : '');
  }
  function nyDate(d) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date());
  }
  function nyHour() {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  }
  function meters(a, b) {
    if (a.lat == null || b.lat == null || a.lon == null || b.lon == null) return Infinity;
    var r = 6371000;
    var p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    var dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function colorOf(c, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
    return m ? '#' + m[1].toUpperCase() : (fallback || '#07093E');
  }
  function addStation(list, agency, id, name, lat, lon) {
    if (!id || !name) return;
    list.push({
      agency: agency,
      id: String(id),
      name: titleCase(name),
      lat: lat == null || lat === '' ? null : Number(lat),
      lon: lon == null || lon === '' ? null : Number(lon)
    });
  }
  function buildStations() {
    var list = [];
    (typeof MBTA_TRIP_STATIONS !== 'undefined' ? MBTA_TRIP_STATIONS : []).forEach(function (s) { addStation(list, 'mbta', s.id, s.name, s.lat, s.lon); });
    (typeof AMTRAK_TRIP_STATIONS !== 'undefined' ? AMTRAK_TRIP_STATIONS : []).forEach(function (s) { addStation(list, 'amtrak', s.id, s.name, s.lat, s.lon); });
    (typeof MNR_TRIP_STATIONS !== 'undefined' ? MNR_TRIP_STATIONS : []).forEach(function (s) { addStation(list, 'mnr', s.id, s.name, s.lat, s.lon); });
    (extra.lirr.stops || []).forEach(function (s) { addStation(list, 'lirr', s.id, s.name, s.lat, s.lon); });
    (extra.marc.stops || []).forEach(function (s) { addStation(list, 'marc', s.id, s.name, s.lat, s.lon); });
    [
      { id: 'NHV', name: 'New Haven', lat: 41.2976, lon: -72.9267 },
      { id: 'STS', name: 'New Haven State Street', lat: 41.305, lon: -72.9217 },
      { id: 'WFD', name: 'Wallingford', lat: 41.457, lon: -72.825 },
      { id: 'MDN', name: 'Meriden', lat: 41.539, lon: -72.801 },
      { id: 'BER', name: 'Berlin', lat: 41.636, lon: -72.766 },
      { id: 'HFD', name: 'Hartford', lat: 41.769, lon: -72.681 },
      { id: 'WND', name: 'Windsor', lat: 41.852, lon: -72.642 },
      { id: 'WNL', name: 'Windsor Locks', lat: 41.914, lon: -72.627 },
      { id: 'SPG', name: 'Springfield', lat: 42.1061, lon: -72.593 }
    ].forEach(function (s) { addStation(list, 'ctrail', s.id, s.name, s.lat, s.lon); });
    [
      { id: 'BEKW', name: 'Miami', lat: 25.778, lon: -80.196 },
      { id: 'BAVE', name: 'Aventura', lat: 25.957, lon: -80.143 },
      { id: 'BFBT', name: 'Fort Lauderdale', lat: 26.122, lon: -80.146 },
      { id: 'BRRN', name: 'Boca Raton', lat: 26.352, lon: -80.086 },
      { id: 'BWPT', name: 'West Palm Beach', lat: 26.712, lon: -80.054 },
      { id: 'BMCO', name: 'Orlando', lat: 28.417, lon: -81.581 }
    ].forEach(function (s) { addStation(list, 'brightline', s.id, s.name, s.lat, s.lon); });
    (window.RR_NJT_STATIONS || []).forEach(function (s, i) {
      addStation(list, 'njt', 'n' + i + ':' + s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), s.name, null, null);
      list[list.length - 1].color = s.color;
    });
    return list;
  }
  function samePlace(a, b) {
    if (a.agency !== b.agency && a.id && a.id === b.id && /^(amtrak|ctrail|via|brightline)$/.test(a.agency) && /^(amtrak|ctrail|via|brightline)$/.test(b.agency)) return true;
    var d = meters(a, b);
    if (d <= 300) return true;
    var an = a.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    var bn = b.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return an && an === bn && d <= 1500;
  }
  function buildHubs(stations) {
    var out = [];
    stations.forEach(function (s) {
      var hub = null;
      for (var i = 0; i < out.length; i++) {
        if (out[i].members.some(function (m) { return samePlace(m, s); })) { hub = out[i]; break; }
      }
      if (!hub) {
        hub = { members: [], name: s.name, rank: 99 };
        out.push(hub);
      }
      hub.members.push(s);
      var rank = RANK[s.agency] == null ? 9 : RANK[s.agency];
      if (rank < hub.rank) { hub.rank = rank; hub.name = s.name; }
    });
    out.forEach(function (h) {
      h.key = h.members.slice().sort(function (a, b) { return (RANK[a.agency] || 9) - (RANK[b.agency] || 9); })[0];
      h.agencies = [];
      h.members.forEach(function (m) {
        var label = AGENCY_LABEL[m.agency] || m.agency;
        if (h.agencies.indexOf(label) < 0) h.agencies.push(label);
      });
    });
    return out;
  }
  function findHub(raw) {
    var q = String(raw || '').trim();
    if (!q) return null;
    var low = q.toLowerCase();
    var colon = q.indexOf(':');
    if (colon > 0) {
      var ag = q.slice(0, colon).toLowerCase();
      var id = q.slice(colon + 1);
      for (var i = 0; i < hubs.length; i++) {
        if (hubs[i].members.some(function (m) { return m.agency === ag && m.id.toLowerCase() === id.toLowerCase(); })) return hubs[i];
      }
    }
    var named = hubs.filter(function (h) { return h.name.toLowerCase() === low; });
    if (named.length === 1) return named[0];
    if (named.length > 1) return named.sort(function (a, b) { return a.rank - b.rank; })[0];
    var byId = hubs.filter(function (h) { return h.members.some(function (m) { return m.id.toLowerCase() === low; }); });
    if (byId.length === 1) return byId[0];
    return null;
  }

  function fsVal(v) {
    if (!v || typeof v !== 'object') return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return v.integerValue;
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(fsVal);
    if (v.mapValue) {
      var o = {};
      var fields = v.mapValue.fields || {};
      Object.keys(fields).forEach(function (k) { o[k] = fsVal(fields[k]); });
      return o;
    }
    return null;
  }
  function equipLabel(rep) {
    var locos = Array.isArray(rep.locomotives) && rep.locomotives.length ? rep.locomotives : null;
    var parts = [];
    function one(id, type, name) {
      id = String(id || '').trim();
      type = String(type || '').trim();
      name = String(name || '').trim();
      if (name) return name;
      if (type && id) return type + ' #' + id;
      if (type) return type;
      if (id) return '#' + id;
      return '';
    }
    if (locos) locos.forEach(function (L) { var t = one(L.locomotiveId || L.id, L.locoType, L.unitName); if (t) parts.push(t); });
    else {
      var a = one(rep.locomotiveId, rep.locoType, rep.unitName);
      var b = one(rep.locomotiveId2, rep.locoType2, rep.unitName2);
      if (a) parts.push(a);
      if (b) parts.push(b);
    }
    return parts.join(' + ');
  }
  var FS_DOC = 'https://firestore.googleapis.com/v1/projects/railroadradar-accounts/databases/(default)/documents/trainReports/';
  function decodeFields(fields) {
    var data = {};
    Object.keys(fields || {}).forEach(function (k) { data[k] = fsVal(fields[k]); });
    return data;
  }
  function reportDoc(id) {
    if (!window.rrFsCache || !id) return Promise.resolve('');
    return window.rrFsCache.doc('trainReports:doc:' + id, REPORTS_TTL_MS, function () {
      return fetch(FS_DOC + encodeURIComponent(id) + '?key=AIzaSyBCXgIwkKHBrNfs4-0T0L9LQNb6GP-37Qs').then(function (res) {
        if (res.status === 404) return { id: id, exists: false, data: function () { return {}; } };
        if (!res.ok) throw new Error('report ' + res.status);
        return res.json().then(function (body) {
          return { id: id, exists: true, data: function () { return decodeFields(body.fields); } };
        });
      });
    }).then(function (snap) {
      if (!snap || snap.exists === false) return '';
      var rep = snap.data() || {};
      var agency = String(rep.agency || '').toLowerCase();
      var sd = String(rep.serviceDate || '');
      if (agency !== 'mbta' && sd && sd !== nyDate()) return '';
      return equipLabel(rep);
    }).catch(function () { return ''; });
  }
  function reportIds(r) {
    var ids = [];
    var today = nyDate();
    var tn = String(r.trainNum || '').trim();
    var alt = tn.replace(/^0+/, '') || tn;
    var agencies = [r.agency];
    if (r.agency === 'amtrak' || r.agency === 'ctrail' || r.agency === 'via' || r.agency === 'brightline') {
      ['amtrak', 'ctrail', 'via'].forEach(function (a) { if (agencies.indexOf(a) < 0) agencies.push(a); });
    }
    agencies.forEach(function (a) {
      if (a === 'mbta') {
        if (r.vehicleId) ids.push('mbta_' + r.vehicleId);
      } else if (tn) {
        ids.push(a + '_' + today + '_' + tn);
        if (alt !== tn) ids.push(a + '_' + today + '_' + alt);
      }
    });
    return ids;
  }
  function attachEquipment(list) {
    return Promise.all(list.map(function (r) {
      return Promise.all(reportIds(r).map(reportDoc)).then(function (labels) {
        r.equipment = labels.filter(Boolean)[0] || '';
      });
    })).then(function () { return list; });
  }

  function expectedTime(row) {
    return row.predicted || row.scheduled;
  }
  function delayMinutes(row) {
    if (!row.predicted || !row.scheduled) return 0;
    return Math.round((row.predicted.getTime() - row.scheduled.getTime()) / 60000);
  }
  function toneOf(row) {
    var text = String(row.status || '');
    if (/cancel/i.test(text)) return { label: 'Cancelled', tone: 'late' };
    if (!row.predicted) return { label: 'Scheduled', tone: 'sched' };
    var delay = delayMinutes(row);
    if (delay >= 1) return { label: 'Delayed ' + fmtDelay(delay), tone: delay >= 15 ? 'late' : 'warn' };
    return { label: 'On Time', tone: 'ok' };
  }
  function soonText(when) {
    if (!when) return '';
    var sec = (when.getTime() - Date.now()) / 1000;
    if (sec < 120) return 'Now';
    var mins = Math.floor(sec / 60);
    if (mins < 60) return mins + ' min';
    return '';
  }
  function keep(when) {
    if (!when || isNaN(when.getTime())) return false;
    var dt = when.getTime() - Date.now();
    if (dt < -30 * 1000) return false;
    return dt < HORIZON_MS;
  }
  function row(partial) {
    var when = partial.predicted || partial.scheduled;
    if (!keep(when) && !/cancel/i.test(String(partial.status || ''))) return null;
    partial.sort = when ? when.getTime() : 0;
    return partial;
  }

  function cached(key, ttl, run) {
    var hit = feedCache[key];
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
    if (hit && hit.flight) return hit.flight;
    var flight = Promise.resolve().then(run).then(function (value) {
      feedCache[key] = { at: Date.now(), value: value };
      return value;
    }, function (err) {
      delete feedCache[key];
      throw err;
    });
    feedCache[key] = { at: 0, flight: flight };
    return flight;
  }
  function jsonGet(url) {
    return cached(url, 50000, function () {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error(url + ' ' + res.status);
        return res.json();
      });
    });
  }

  function mbtaRows(ids) {
    var today = nyDate();
    var hour = nyHour();
    var dates = [today];
    if (hour >= 21 || hour < 4) {
      var next = new Date(Date.now() + 6 * 3600000);
      var nd = nyDate(next);
      if (dates.indexOf(nd) < 0) dates.push(nd);
    }
    var predUrl = API + '/api/mbta/predictions?filter[stop]=' + encodeURIComponent(ids.join(',')) + '&filter[route_type]=2&include=trip,route,schedule,stop&sort=departure_time';
    var schedUrls = dates.map(function (dt) {
      return API + '/api/mbta/schedules?filter[stop]=' + encodeURIComponent(ids.join(',')) + '&filter[date]=' + encodeURIComponent(dt) + '&include=trip,route,stop&sort=departure_time&page[limit]=200';
    });
    return Promise.all([jsonGet(predUrl)].concat(schedUrls.map(jsonGet))).then(function (packs) {
      var pred = packs[0] || {};
      var sched = { data: [], included: [] };
      packs.slice(1).forEach(function (j) {
        if (j && j.data) sched.data = sched.data.concat(j.data);
        if (j && j.included) sched.included = sched.included.concat(j.included);
      });
      function inc(bag, type, id) {
        var list = (bag && bag.included) || [];
        for (var i = 0; i < list.length; i++) if (list[i].type === type && list[i].id === id) return list[i];
        return null;
      }
      var seen = Object.create(null);
      var out = [];
      ((pred && pred.data) || []).forEach(function (p) {
        var attr = p.attributes || {};
        if (!attr.departure_time) return;
        var tripId = p.relationships && p.relationships.trip && p.relationships.trip.data && p.relationships.trip.data.id;
        if (!tripId || seen[tripId]) return;
        seen[tripId] = 1;
        var trip = inc(pred, 'trip', tripId);
        var routeId = p.relationships.route && p.relationships.route.data && p.relationships.route.data.id;
        var route = inc(pred, 'route', routeId);
        var schedRel = p.relationships.schedule && p.relationships.schedule.data && p.relationships.schedule.data.id;
        var schedItem = inc(pred, 'schedule', schedRel);
        var stop = inc(pred, 'stop', p.relationships.stop && p.relationships.stop.data && p.relationships.stop.data.id);
        var predicted = new Date(attr.departure_time);
        var scheduled = schedItem && schedItem.attributes && schedItem.attributes.departure_time ? new Date(schedItem.attributes.departure_time) : predicted;
        var cancelled = /cancel/i.test(String(attr.schedule_relationship || ''));
        var delay = scheduled ? (predicted - scheduled) / 60000 : null;
        var track = stop && stop.attributes && (stop.attributes.platform_code || stop.attributes.platform_name);
        var made = row({
          agency: 'mbta', tripId: tripId, trainNum: (trip && trip.attributes && trip.attributes.name) || '',
          routeName: (route && route.attributes && (route.attributes.long_name || route.attributes.short_name)) || 'MBTA',
          destination: (trip && trip.attributes && trip.attributes.headsign) || '',
          lineColor: colorOf(route && route.attributes && route.attributes.color, '#80276C'),
          scheduled: scheduled, predicted: predicted, delay: delay, track: track ? String(track) : '',
          status: cancelled ? 'Cancelled' : '', departed: false,
          stopId: stop && stop.id, nextStop: ''
        });
        if (made) out.push(made);
      });
      (sched.data || []).forEach(function (s) {
        var attr = s.attributes || {};
        if (!attr.departure_time) return;
        var tripId = s.relationships && s.relationships.trip && s.relationships.trip.data && s.relationships.trip.data.id;
        if (!tripId || seen[tripId]) return;
        seen[tripId] = 1;
        var trip = inc(sched, 'trip', tripId);
        var routeId = s.relationships.route && s.relationships.route.data && s.relationships.route.data.id;
        var route = inc(sched, 'route', routeId);
        var when = new Date(attr.departure_time);
        var made = row({
          agency: 'mbta', tripId: tripId, trainNum: (trip && trip.attributes && trip.attributes.name) || '',
          routeName: (route && route.attributes && (route.attributes.long_name || route.attributes.short_name)) || 'MBTA',
          destination: (trip && trip.attributes && trip.attributes.headsign) || '',
          lineColor: colorOf(route && route.attributes && route.attributes.color, '#80276C'),
          scheduled: when, predicted: null, delay: null, track: '', status: 'Scheduled', departed: false,
          stopId: s.relationships && s.relationships.stop && s.relationships.stop.data && s.relationships.stop.data.id, nextStop: ''
        });
        if (made) out.push(made);
      });
      return jsonGet(API + '/api/mbta/vehicles?filter[route_type]=2').then(function (body) {
        var byTrip = Object.create(null);
        ((body && body.data) || []).forEach(function (v) {
          var trip = v.relationships && v.relationships.trip && v.relationships.trip.data && v.relationships.trip.data.id;
          if (trip) byTrip[trip] = String(v.id);
        });
        out.forEach(function (r) { if (byTrip[r.tripId]) r.vehicleId = byTrip[r.tripId]; });
        return Promise.all(out.map(function (r) {
          if (!r.tripId || !r.stopId) return null;
          return jsonGet(API + '/api/mbta/schedules?filter[trip]=' + encodeURIComponent(r.tripId) + '&include=stop&sort=stop_sequence').then(function (schedBody) {
            var data = (schedBody && schedBody.data) || [];
            var included = (schedBody && schedBody.included) || [];
            var idx = -1;
            for (var i = 0; i < data.length; i++) {
              var sid = data[i].relationships && data[i].relationships.stop && data[i].relationships.stop.data && data[i].relationships.stop.data.id;
              if (String(sid) === String(r.stopId)) { idx = i; break; }
            }
            var nxt = idx >= 0 ? data[idx + 1] : null;
            var nid = nxt && nxt.relationships && nxt.relationships.stop && nxt.relationships.stop.data && nxt.relationships.stop.data.id;
            if (!nid) return;
            for (var j = 0; j < included.length; j++) {
              if (included[j].type === 'stop' && String(included[j].id) === String(nid)) {
                r.nextStop = (included[j].attributes && included[j].attributes.name) || '';
              }
            }
          }).catch(function () {});
        })).then(function () { return out; });
      }).catch(function () { return out; });
    });
  }

  function amtrakFamily(train) {
    var hay = [train.provider, train.providerShort, train.routeName, train.trainNum].join(' ');
    if (/brightline/i.test(hay)) return 'brightline';
    if (/via/i.test(hay)) return 'via';
    var codes = (train.stations || []).map(function (s) { return String(s.code || '').toUpperCase(); });
    if (['HFD', 'WFD', 'MDN', 'BER'].some(function (c) { return codes.indexOf(c) >= 0; })) return 'ctrail';
    return 'amtrak';
  }
  function amtrakColor(kind, routeName) {
    if (kind === 'brightline') return '#FFD100';
    if (kind === 'via') return '#FFC20E';
    if (kind === 'ctrail') return '#EA0D2A';
    if (/acela/i.test(String(routeName || ''))) return '#00B3E3';
    return '#003366';
  }
  function amtrakRows(codes) {
    var want = {};
    codes.forEach(function (c) { want[String(c).toUpperCase()] = true; });
    return jsonGet(API + '/api/amtrak/trains').then(function (body) {
      var out = [];
      Object.keys(body || {}).forEach(function (k) {
        var bucket = body[k];
        var train = Array.isArray(bucket) ? bucket[0] : bucket;
        if (!train || !Array.isArray(train.stations)) return;
        var kind = amtrakFamily(train);
        var stops = train.stations;
        for (var i = 0; i < stops.length - 1; i++) {
          var s = stops[i];
          if (!s || s.bus || !want[String(s.code || '').toUpperCase()]) continue;
          if (String(s.status || '').toLowerCase() === 'departed') continue;
          var sch = new Date(s.schDep || s.schArr);
          var est = new Date(s.dep || s.arr || s.schDep || s.schArr);
          if (isNaN(est.getTime())) continue;
          var scheduled = isNaN(sch.getTime()) ? est : sch;
          var cancelled = /cancel/i.test(String(train.trainState || '') + ' ' + String(s.status || '') + ' ' + String(s.depCmnt || ''));
          var last = stops[stops.length - 1];
          var nextName = '';
          for (var n = i + 1; n < stops.length; n++) {
            if (stops[n] && !stops[n].bus && stops[n].name) { nextName = stops[n].name; break; }
          }
          var made = row({
            agency: kind, tripId: train.trainID || train.trainNum, trainNum: train.trainNum || train.trainNumRaw || '',
            routeName: train.routeName || AGENCY_LABEL[kind], destination: (last && last.name) || train.destName || '',
            nextStop: nextName,
            lineColor: amtrakColor(kind, train.routeName), scheduled: scheduled, predicted: est,
            delay: (est - scheduled) / 60000, track: s.platform ? String(s.platform) : '',
            status: cancelled ? 'Cancelled' : '', departed: false
          });
          if (made) out.push(made);
        }
      });
      return out;
    });
  }

  var GTFS = {
    nested: { transit_realtime: { nested: {
      FeedMessage: { fields: { entity: { rule: 'repeated', type: 'FeedEntity', id: 2 } } },
      FeedEntity: { fields: { id: { type: 'string', id: 1 }, is_deleted: { type: 'bool', id: 2 }, trip_update: { type: 'TripUpdate', id: 3 } } },
      TripUpdate: { fields: { trip: { type: 'TripDescriptor', id: 1 }, stop_time_update: { rule: 'repeated', type: 'StopTimeUpdate', id: 2 } } },
      StopTimeUpdate: { fields: { arrival: { type: 'StopTimeEvent', id: 2 }, departure: { type: 'StopTimeEvent', id: 3 }, stop_id: { type: 'string', id: 4 }, schedule_relationship: { type: 'int32', id: 5 } } },
      StopTimeEvent: { fields: { delay: { type: 'int32', id: 1 }, time: { type: 'int64', id: 2 } } },
      TripDescriptor: { fields: { trip_id: { type: 'string', id: 1 }, route_id: { type: 'string', id: 5 }, schedule_relationship: { type: 'int32', id: 4 } } }
    } } }
  };
  var feedType = null;
  function decodeFeed(buf) {
    if (!feedType) {
      if (!window.protobuf || !protobuf.Root) throw new Error('protobuf');
      feedType = protobuf.Root.fromJSON(GTFS).lookupType('transit_realtime.FeedMessage');
    }
    return feedType.decode(new Uint8Array(buf));
  }
  function unix(t) {
    if (t == null || t === '') return null;
    var n = (typeof t === 'object' && t.toNumber) ? t.toNumber() : Number(t);
    if (!isFinite(n) || n <= 0) return null;
    if (n > 1e12) n = Math.floor(n / 1000);
    var d = new Date(n * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  function stopMatch(stopId, ids) {
    var s = String(stopId || '');
    return ids.some(function (id) {
      if (s === id) return true;
      if (s.indexOf(id) !== 0) return false;
      var next = s.charAt(id.length);
      return next && !/\d/.test(next);
    });
  }
  function trainNumFrom(entity, tripId) {
    var parts = String(tripId || entity.id || '').split('_');
    var last = '';
    for (var i = parts.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(parts[i])) {
        last = parts[i];
        if (parts[i].length >= 3) return parts[i];
      }
    }
    return last || String(entity.id || '').replace(/_V$|_T$/, '');
  }
  function gtfsRows(agency, ids, url) {
    var routes = agency === 'mnr' ? extra.mnrRoutes : (agency === 'lirr' ? extra.lirr.routes : extra.marc.routes);
    var stops = agency === 'lirr' ? extra.lirr.stops : (agency === 'marc' ? extra.marc.stops : (typeof MNR_TRIP_STATIONS !== 'undefined' ? MNR_TRIP_STATIONS : []));
    function stopName(id) {
      for (var i = 0; i < stops.length; i++) if (String(stops[i].id) === String(id)) return stops[i].name;
      return '';
    }
    return cached(url, 50000, function () {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error(url + ' ' + res.status);
        return res.arrayBuffer();
      }).then(decodeFeed);
    }).then(function (feed) {
      var out = [];
      (feed.entity || []).forEach(function (entity) {
        if (!entity || entity.is_deleted || !entity.trip_update) return;
        var tu = entity.trip_update;
        var updates = tu.stop_time_update || [];
        var hit = -1;
        for (var i = 0; i < updates.length; i++) if (stopMatch(updates[i].stop_id, ids)) { hit = i; break; }
        if (hit < 0 || hit === updates.length - 1) return;
        var stu = updates[hit];
        var rel = Number(stu.schedule_relationship);
        if (rel === 1) return;
        var dep = unix(stu.departure && stu.departure.time) || unix(stu.arrival && stu.arrival.time);
        if (!dep) return;
        var delaySec = stu.departure && stu.departure.delay != null ? Number(stu.departure.delay) : (stu.arrival && stu.arrival.delay != null ? Number(stu.arrival.delay) : 0);
        var delay = isFinite(delaySec) ? Math.round(delaySec / 60) : 0;
        var scheduled = new Date(dep.getTime() - delay * 60000);
        var routeId = tu.trip && tu.trip.route_id != null ? String(tu.trip.route_id) : '';
        var route = routes[routeId] || {};
        var routeName = route.name || (agency === 'mnr' ? 'Metro-North' : agency.toUpperCase());
        if (agency === 'mnr' && route.name && !/\bline$/i.test(route.name)) routeName = route.name + ' Line';
        var last = updates[updates.length - 1];
        var nxt = updates[hit + 1];
        var made = row({
          agency: agency, tripId: (tu.trip && tu.trip.trip_id) || entity.id,
          trainNum: trainNumFrom(entity, tu.trip && tu.trip.trip_id),
          routeName: routeName, destination: stopName(last && last.stop_id) || '',
          nextStop: stopName(nxt && nxt.stop_id) || '',
          lineColor: colorOf(route.color, agency === 'marc' ? '#FF8000' : '#0039A6'),
          scheduled: scheduled, predicted: dep, delay: delay, track: '',
          status: rel === 3 ? 'Cancelled' : '', departed: false
        });
        if (made) out.push(made);
      });
      return out;
    });
  }

  function njtRows(names) {
    var want = {};
    names.forEach(function (n) { want[n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = true; });
    return jsonGet(API + '/api/njt/vehicles').then(function (body) {
      var list = Array.isArray(body) ? body : (body.trains || body.TRAINS || body.vehicles || []);
      if (body && body.TRAINS && Array.isArray(body.TRAINS.TRAINS)) list = body.TRAINS.TRAINS;
      var out = [];
      (list || []).forEach(function (raw) {
        var stops = raw.stops || raw.STOPS || [];
        if (!Array.isArray(stops)) return;
        var line = String(raw.LINE || raw.line || raw.lineCode || raw.TRAIN_LINE || '');
        var num = String(raw.ID || raw.id || raw.trainId || raw.TRAIN_ID || '');
        var color = '#FF671F';
        (window.RR_NJT_STATIONS || []).some(function (s) {
          if (line && s.name.toLowerCase() === line.toLowerCase()) { color = s.color; return true; }
          return false;
        });
        for (var i = 0; i < stops.length - 1; i++) {
          var st = stops[i];
          var name = String(st.STATIONNAME || st.stationName || st.name || st.STOP_NAME || '');
          var key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          if (!want[key]) continue;
          if (String(st.DEPARTED || st.departed || '').toUpperCase() === 'YES') continue;
          var est = new Date(st.TIME_UTC || st.timeUtc || st.DEP_TIME_UTC || NaN);
          if (isNaN(est.getTime()) && st.TIME) est = new Date(st.TIME);
          if (isNaN(est.getTime())) continue;
          var sch = st.DEP_TIME ? new Date(st.DEP_TIME) : est;
          if (isNaN(sch.getTime())) sch = est;
          var sec = Number(raw.SEC_LATE != null ? raw.SEC_LATE : st.SEC_LATE);
          var delay = isFinite(sec) ? Math.round(sec / 60) : (est - sch) / 60000;
          var dest = stops[stops.length - 1];
          var nxt = stops[i + 1];
          var made = row({
            agency: 'njt', tripId: num, trainNum: num, routeName: line || 'NJ Transit',
            destination: String((dest && (dest.STATIONNAME || dest.name)) || raw.DESTINATION || ''),
            nextStop: String((nxt && (nxt.STATIONNAME || nxt.stationName || nxt.name || nxt.STOP_NAME)) || ''),
            lineColor: colorOf(raw.hexcolor || raw.HEXCOLOR, color),
            scheduled: sch, predicted: est, delay: delay, track: st.TRACK ? String(st.TRACK) : '',
            status: /cancel/i.test(String(raw.STATUS || '')) ? 'Cancelled' : '', departed: false
          });
          if (made) out.push(made);
        }
      });
      return out;
    });
  }

  function loadHub(hub) {
    var jobs = [];
    var by = {};
    hub.members.forEach(function (m) {
      if (!by[m.agency]) by[m.agency] = [];
      by[m.agency].push(m);
    });
    if (by.mbta) jobs.push(mbtaRows(by.mbta.map(function (m) { return m.id; })));
    var codes = [].concat(by.amtrak || [], by.ctrail || [], by.via || [], by.brightline || []).map(function (m) { return m.id; });
    if (codes.length) jobs.push(amtrakRows(codes));
    if (by.mnr) jobs.push(gtfsRows('mnr', by.mnr.map(function (m) { return m.id; }), API + '/api/mta/mnr'));
    if (by.lirr) jobs.push(gtfsRows('lirr', by.lirr.map(function (m) { return m.id; }), API + '/api/mta/lirr'));
    if (by.marc) jobs.push(gtfsRows('marc', by.marc.map(function (m) { return m.id; }), 'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-tu.pb'));
    if (by.njt) jobs.push(njtRows(by.njt.map(function (m) { return m.name; })).catch(function () { return []; }));
    return Promise.all(jobs.map(function (p) { return p.catch(function () { return []; }); })).then(function (lists) {
      var all = [];
      lists.forEach(function (list) { all = all.concat(list); });
      var seen = Object.create(null);
      all = all.filter(function (r) {
        var train = String(r.trainNum || '').trim().toUpperCase().replace(/\\s+/g, ' ');
        var route = String(r.routeName || '').trim().toLowerCase();
        var departure = r.scheduled || r.predicted;
        var minute = departure && isFinite(departure.getTime())
          ? Math.floor(departure.getTime() / 60000)
          : Math.floor(Number(r.sort || 0) / 60000);
        var identity = train ? train + ':' + route : String(r.tripId || '');
        var k = String(r.agency || '') + ':' + identity + ':' + minute;
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
      all.sort(function (a, b) { return a.sort - b.sort; });
      return all.slice(0, 4);
    });
  }

  function hubPoint(hub) {
    var pts = (hub.members || []).filter(function (m) { return m && isFinite(m.lat) && isFinite(m.lon); });
    if (!pts.length) return null;
    var lat = 0, lon = 0;
    pts.forEach(function (m) { lat += m.lat; lon += m.lon; });
    return [lat / pts.length, lon / pts.length];
  }
  function paintMap(hub) {
    var pt = hub && hubPoint(hub);
    var frame = document.getElementById('station-map');
    if (!frame || !pt) return;
    var url = '/map/?embed=board&lat=' + encodeURIComponent(pt[0].toFixed(5)) + '&lng=' + encodeURIComponent(pt[1].toFixed(5)) + '&z=12';
    if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
  }

  var pick = document.getElementById('pick');
  var board = document.getElementById('board');
  var input = document.getElementById('station-q');
  var results = document.getElementById('station-results');
  var changeBtn = document.getElementById('change-station');
  var rowsEl = document.getElementById('rows');
  var pageInd = document.getElementById('page-ind');
  var selectedIndex = 0;

  function showPick(on) {
    pick.hidden = !on;
    board.hidden = on;
    if (on) { input.focus(); renderMatches(input.value); }
  }
  function renderMatches(q) {
    var query = String(q || '').trim().toLowerCase();
    results.innerHTML = '';
    selectedIndex = 0;
    if (query.length < 2) return;
    var hits = hubs.filter(function (h) {
      if (h.name.toLowerCase().indexOf(query) >= 0) return true;
      return h.members.some(function (m) { return m.id.toLowerCase().indexOf(query) >= 0; });
    }).slice(0, 40);
    hits.forEach(function (h, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      var dot = h.members[0] && h.members[0].color;
      if (dot) btn.style.setProperty('--rr-sp-line', dot);
      btn.innerHTML = '<span class="pick-name">' + esc(h.name) + '</span><span class="pick-agency">' + esc(h.agencies.join(' · ')) + '</span>';
      btn.addEventListener('click', function () { choose(h); });
      li.appendChild(btn);
      results.appendChild(li);
    });
  }
  function rowHtml(r) {
    var info = toneOf(r);
    var when = expectedTime(r);
    var late = delayMinutes(r) >= 1;
    var route = titleCase(r.routeName);
    var num = String(r.trainNum || '').trim();
    if (num && route && new RegExp('\\b' + num.replace(/[^\w]/g, '') + '$').test(route)) num = '';
    var title = (route + ' ' + num).trim();
    var nextBit = r.nextStop ? 'Next: ' + r.nextStop : '';
    var equipBit = r.equipment ? r.equipment : 'No Equipment Reported';
    var sub = nextBit ? nextBit + ' · ' + equipBit : equipBit;
    return '<div class="cols row" style="--rr-sp-line:' + esc(r.lineColor || '#07093E') + '">' +
      '<div class="line line-when">' +
      '<span class="time"><span class="time-exp">' + esc(clock(when)) + '</span>' +
      (late ? '<span class="time-sch">' + esc(clock(r.scheduled)) + '</span>' : '') + '</span>' +
      '<span class="mins">' + esc(soonText(when)) + '</span></div>' +
      '<div class="line line-route">' +
      '<span class="train"><span class="train-name">' + esc(title) + '</span><span class="train-sub">' + esc(sub) + '</span></span>' +
      '<span class="dest">' + esc(r.destination || '') + '</span></div>' +
      '<div class="line line-extra">' +
      '<span class="col-track">' + esc(r.track || '') + '</span>' +
      '<span class="status st-' + info.tone + '">' + esc(info.label) + '</span></div></div>';
  }
  function pageCount() {
    return boardList.length > 2 ? 2 : 1;
  }
  function drawPage() {
    var pages = pageCount();
    if (pageIndex >= pages) pageIndex = 0;
    var slice = boardList.slice(pageIndex * 2, pageIndex * 2 + 2);
    if (!slice.length) rowsEl.innerHTML = '<div class="empty">No Upcoming Departures</div>';
    else rowsEl.innerHTML = slice.map(rowHtml).join('');
    if (pages > 1) {
      pageInd.hidden = false;
      pageInd.textContent = (pageIndex + 1) + '/2';
    } else {
      pageInd.hidden = true;
    }
  }
  function flipPage() {
    if (fading || pageCount() < 2 || document.hidden) return;
    fading = true;
    rowsEl.classList.add('is-fading');
    setTimeout(function () {
      pageIndex = pageIndex === 0 ? 1 : 0;
      drawPage();
      rowsEl.classList.remove('is-fading');
      fading = false;
    }, 420);
  }
  function refresh() {
    if (!current || loading || document.hidden) return;
    loading = true;
    loadHub(current).then(function (list) {
      return attachEquipment(list);
    }).then(function (list) {
      if (!current) return;
      boardList = list;
      if (boardList.length <= 2) pageIndex = 0;
      if (!fading) drawPage();
      paintMap(current);
    }).catch(function () {
      if (current) pageInd.hidden = pageCount() < 2;
    }).then(function () { loading = false; });
  }
  function choose(hub) {
    current = hub;
    pageIndex = 0;
    boardList = [];
    fading = false;
    rowsEl.classList.remove('is-fading');
    var primary = hub.key;
    var param = primary.agency + ':' + primary.id;
    try { history.replaceState(null, '', location.pathname + '?station=' + encodeURIComponent(param)); } catch (_) {}
    showPick(false);
    rowsEl.innerHTML = '<div class="empty">Loading Departures</div>';
    paintMap(hub);
    pageInd.hidden = true;
    changeBtn.setAttribute('data-station', hub.name);
    refresh();
    if (timer) clearInterval(timer);
    if (pageTimer) clearInterval(pageTimer);
    timer = setInterval(refresh, REFRESH_MS);
    pageTimer = setInterval(flipPage, PAGE_MS);
  }
  input.addEventListener('input', function () { renderMatches(input.value); });
  input.addEventListener('keydown', function (e) {
    var buttons = results.querySelectorAll('button');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!buttons.length) return;
      selectedIndex = e.key === 'ArrowDown' ? Math.min(buttons.length - 1, selectedIndex + 1) : Math.max(0, selectedIndex - 1);
      buttons.forEach(function (b, i) { b.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false'); });
      buttons[selectedIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && buttons[selectedIndex]) {
      e.preventDefault();
      buttons[selectedIndex].click();
    }
  });
  changeBtn.addEventListener('click', function () { showPick(true); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });

  hubs = buildHubs(buildStations());
  var initial = findHub(new URLSearchParams(location.search).get('station'));
  if (initial) choose(initial);
  else showPick(true);
})();
