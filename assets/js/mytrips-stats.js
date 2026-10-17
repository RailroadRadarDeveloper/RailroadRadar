/* ===== My Trips: "More stats" panel =====
   Loaded after app-main.js on the My Trips page; uses its globals (fetchAllUserTripLogs, findTripStation,
   track shapes, map tiles). Computed only from fields trips already save: segment railroad, line, origin and
   destination ids and names, depart and arrive times (actual times when present) and miles. Nothing new is
   collected. Stations count only where you boarded or got off (including transfers); a station shared by
   railroads counts once and shows as visited on every line it is on. The panel rebuilds whenever the summary
   stats are repainted, which both trip save and trip delete do. */
(function () {
  var MS_TRIPS = null;          // all of the user's trips, loaded once when the panel is first opened
  var MS_LOADING = null;
  var MS_OPEN = false;
  var DAY = 864e5;
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ms(v) { var d = tripAsDate(v); return d && !isNaN(d.getTime()) ? d.getTime() : 0; }
  function segsOf(t) {
    if (Array.isArray(t.segments) && t.segments.length) return t.segments;
    return [{ railroad: t.railroad, lineId: t.lineId, lineName: t.lineName, originStationId: t.originStationId, originName: t.originName,
      destStationId: t.destStationId, destName: t.destName, departTime: t.startTime || t.departTime, arriveTime: t.endTime || t.arriveTime,
      actualDepartTime: t.actualDepartTime, actualArriveTime: t.actualArriveTime, miles: t.miles }];
  }
  // Riding time of one segment: actual times when both were recorded, else scheduled.
  function segMinutes(s, t, i, n) {
    if (s.openEnded) return 0;
    var ad = s.actualDepartTime || (i === 0 && n === 1 ? t.actualDepartTime : null);
    var aa = s.actualArriveTime || (i === n - 1 && n === 1 ? t.actualArriveTime : null);
    var d = ms(ad), a = ms(aa);
    if (!(d && a && a > d)) { d = ms(s.departTime || s.startTime); a = ms(s.arriveTime || s.endTime); }
    var m = (a - d) / 6e4;
    return m > 0 && m < 36 * 60 ? m : 0;
  }
  function fmtDur(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' min';
    return h.toLocaleString() + ' h' + (m ? ' ' + m + ' min' : '');
  }
  function fmtMi(n) { return n >= 100 ? Math.round(n).toLocaleString() + ' mi' : (Math.round(n * 10) / 10) + ' mi'; }
  function lineInfo(rr, lid, fallbackName) {
    var pack = (typeof TRIP_LINE_STOPS !== 'undefined' && TRIP_LINE_STOPS[rr]) ? TRIP_LINE_STOPS[rr][lid] : null;
    var list = [];
    try { list = getTripLogStationsForLine(rr, lid) || []; } catch (_) {}
    var seen = {}, ids = [];
    list.forEach(function (s) { if (s && s.id != null && !seen[s.id]) { seen[s.id] = 1; ids.push(s); } });
    return { name: (pack && pack.n) || fallbackName || lid, stations: ids };
  }
  // Same physical station on several railroads (South Station on MBTA and Amtrak, Stamford on
  // Amtrak and Metro-North). Same rule as the Station audio picker: different railroads, within
  // 0.22 mi, or within 0.35 mi with the same cleaned name. Different stations that share a name
  // (New Haven Union Station and State Street, Boston and Back Bay) are farther apart and stay separate.
  var MERGE_MI = 0.22, MERGE_NAME_MI = 0.35;
  function cleanPlaceName(name) {
    var s = String(name || '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^Ny Moynihan Train Hall At Penn Station$/i, 'Penn Station');
    s = s.replace(/^UNION STATION Washington$/i, 'Washington Union Station');
    s = s.replace(/\s+Amtrak Station$/i, '').replace(/\s+Amtrak$/i, '').replace(/\s+Marc$/i, '');
    return s.replace(/\s+/g, ' ').trim();
  }
  function normName(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(station|stop|amtrak|mbta|terminal)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function looseName(a, b) {
    var na = normName(a), nb = normName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    var sh = na.length < nb.length ? na : nb, lo = na.length < nb.length ? nb : na;
    return sh.length >= 8 && (lo.indexOf(sh + ' ') === 0 || lo.indexOf(' ' + sh) === lo.length - sh.length - 1 || lo.indexOf(' ' + sh + ' ') >= 0);
  }
  function buildPlaces(keys) {
    var uniq = [], seen = {};
    keys.forEach(function (k) { if (!seen[k]) { seen[k] = 1; uniq.push(k); } });
    var info = uniq.map(function (k) {
      var i = k.indexOf(':'), rr = k.slice(0, i), st = null;
      try { st = findTripStation(rr, k.slice(i + 1)); } catch (_) {}
      return { k: k, rr: rr, lat: st ? +st.lat : NaN, lon: st ? +st.lon : NaN, name: cleanPlaceName(st && st.name) };
    });
    var parent = info.map(function (_, i) { return i; });
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    for (var a = 0; a < info.length; a++) {
      var A = info[a];
      if (!isFinite(A.lat) || !isFinite(A.lon)) continue;
      for (var b = a + 1; b < info.length; b++) {
        var B = info[b];
        if (B.rr === A.rr || !isFinite(B.lat) || !isFinite(B.lon)) continue;
        var d = haversineMiles(A.lat, A.lon, B.lat, B.lon);
        if (d <= MERGE_MI || (d <= MERGE_NAME_MI && looseName(A.name, B.name))) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
      }
    }
    var out = {};
    info.forEach(function (x, i) { out[x.k] = info[find(i)].k; });
    return out;
  }
  function compute(trips) {
    var now = Date.now();
    var ridden = trips.filter(function (t) { var s = tripStartMs(t); return s && s <= now && !t.cancelled; });
    var out = { trips: ridden.length, miles: 0, minutes: 0, longDist: null, longTime: null, endpoints: {}, visited: {}, lines: {},
      dow: [0, 0, 0, 0, 0, 0, 0], tod: { Morning: 0, Midday: 0, Evening: 0, Night: 0 }, months: [], longestStreak: 0, linesDone: 0, noStopList: 0, combos: [] };
    out.upcoming = trips.filter(function (t) { var s = tripStartMs(t); return s && s > now && !t.cancelled; }).length;
    var lineCache = {}, days = {};
    ridden.forEach(function (t) {
      var segs = segsOf(t), mins = 0, miles = tripMilesValue(t);
      out.miles += miles;
      segs.forEach(function (s, i) {
        mins += segMinutes(s, t, i, segs.length);
        var rr = String(s.railroad || t.railroad || '').toLowerCase();
        var o = s.originStationId, d = s.destStationId;
        [o, d].forEach(function (id) { if (id) { out.endpoints[rr + ':' + id] = (out.endpoints[rr + ':' + id] || 0) + 1; out.visited[rr + ':' + id] = 1; } });
        var lid = String(s.lineId || '');
        if (!lid || !o || !d) return;
        var key = rr + ':' + lid;
        var info = lineCache[key] || (lineCache[key] = lineInfo(rr, lid, s.lineName));
        if (!info.stations.length) { out.noStopList++; return; }
        out.lines[key] = { key: key, rr: rr, lid: lid, name: info.name, stations: info.stations };
      });
      out.minutes += mins;
      if (mins > 0) out.timedTrips = (out.timedTrips || 0) + 1;
      if (miles > 0 && (!out.longDist || miles > out.longDist.v)) out.longDist = { v: miles, t: t };
      if (mins > 0 && (!out.longTime || mins > out.longTime.v)) out.longTime = { v: mins, t: t };
      var start = new Date(tripStartMs(t));
      out.dow[start.getDay()]++;
      var h = start.getHours(), tod = h >= 5 && h < 11 ? 'Morning' : h >= 11 && h < 15 ? 'Midday' : h >= 15 && h < 20 ? 'Evening' : 'Night';
      out.tod[tod]++;
      out.combos.push(start.getDay() + '|' + tod);
      days[start.getFullYear() + '-' + start.getMonth() + '-' + start.getDate()] = start.getTime();
    });
    // One place per physical station, so a station shared by railroads counts once and shows as
    // visited on every line it is on.
    var placeKeys = Object.keys(out.endpoints);
    Object.keys(out.lines).forEach(function (k) { var L = out.lines[k]; L.stations.forEach(function (st) { placeKeys.push(L.rr + ':' + st.id); }); });
    out.placeOf = buildPlaces(placeKeys);
    out.visitedPlaces = {};
    Object.keys(out.endpoints).forEach(function (k) { out.visitedPlaces[out.placeOf[k]] = 1; });
    // Lines: share of the line's stations you've boarded or got off at.
    out.lineList = Object.keys(out.lines).map(function (k) {
      var L = out.lines[k];
      var got = L.stations.filter(function (s) { return out.visitedPlaces[out.placeOf[L.rr + ':' + s.id]]; }).length;
      return { key: k, rr: L.rr, lid: L.lid, name: L.name, stations: L.stations, got: got, total: L.stations.length, pct: L.stations.length ? got / L.stations.length : 0 };
    }).sort(function (a, b) { return b.pct - a.pct || b.got - a.got; });
    out.linesDone = out.lineList.filter(function (l) { return l.total && l.got >= l.total; }).length;
    // Longest run of consecutive days with a trip.
    var dayStarts = Object.keys(days).map(function (k) { var d = new Date(days[k]); d.setHours(12, 0, 0, 0); return d.getTime(); }).sort(function (a, b) { return a - b; });
    var run = 0, prev = 0;
    dayStarts.forEach(function (d) { run = prev && Math.round((d - prev) / DAY) === 1 ? run + 1 : 1; prev = d; if (run > out.longestStreak) out.longestStreak = run; });
    // Trips per month, last 12 months including this one.
    var base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
    for (var i = 11; i >= 0; i--) {
      var m0 = new Date(base.getFullYear(), base.getMonth() - i, 1), m1 = new Date(base.getFullYear(), base.getMonth() - i + 1, 1);
      out.months.push({ label: MON[m0.getMonth()], year: m0.getFullYear(), n: ridden.filter(function (t) { var s = tripStartMs(t); return s >= m0.getTime() && s < m1.getTime(); }).length });
    }
    out.stations = Object.keys(out.visitedPlaces).length;
    out.endpointCount = Object.keys(out.endpoints).length;
    return out;
  }
  var MILESTONES = [
    { group: 'Trips', key: 'trips', steps: [1, 10, 50, 100, 500], label: function (n) { return n === 1 ? 'First trip' : n.toLocaleString() + ' trips'; } },
    { group: 'Miles', key: 'miles', steps: [100, 500, 1000, 5000, 10000], label: function (n) { return n.toLocaleString() + ' miles'; } },
    { group: 'Stations', key: 'stations', steps: [10, 50, 100, 250], label: function (n) { return n + ' stations'; } },
    { group: 'Lines', key: 'linesDone', steps: [1, 3, 5], label: function (n) { return n === 1 ? 'First line completed' : n + ' lines completed'; } }
  ];
  // Short display names. Some railroad names are ambiguous (two "Boston", two "New Haven"), so known ids win.
  var SHORT_BY_ID = { 'amtrak:BBY': 'Back Bay', 'amtrak:BOS': 'Boston', 'amtrak:STS': 'New Haven State Street', 'amtrak:NHV': 'New Haven Union Station',
    'amtrak:NYP': 'New York Penn', 'amtrak:NWK': 'Newark Penn', 'amtrak:NRK': 'Newark, Delaware', 'amtrak:EWR': 'Newark Airport', 'amtrak:BWI': 'BWI Airport',
    'amtrak:WAS': 'Washington Union Station', 'amtrak:BAL': 'Baltimore Penn', 'amtrak:PHL': 'Philadelphia 30th Street', 'amtrak:RVM': 'Richmond Main Street', 'amtrak:RVR': 'Richmond Staples Mill' };
  var SHORT_NAMES = { 'ny moynihan train hall at penn station': 'New York Penn', 'new york penn station': 'New York Penn' };
  function shortName(n, rr, id) {
    var byId = rr && id != null ? SHORT_BY_ID[String(rr).toLowerCase() + ':' + id] : null;
    if (byId) return byId;
    n = String(n || '').trim();
    var k = SHORT_NAMES[n.toLowerCase()];
    if (k) return k;
    return n.replace(/\s+amtrak station$/i, '').replace(/\s+amtrak$/i, '').replace(/\s+penn station$/i, ' Penn') || n;
  }
  function routeText(t) {
    var segs = segsOf(t);
    var f = segs[0], l = segs[segs.length - 1];
    return esc(shortName(f.originName || t.originName, f.railroad || t.railroad, f.originStationId)) + ' to ' + esc(shortName(l.destName || t.destName, l.railroad || t.railroad, l.destStationId));
  }
  function card(title, big, bigLabel, rest, cls) {
    return '<div class="tms-card' + (cls ? ' ' + cls : '') + '"><h3 class="tms-label">' + title + '</h3>' +
      '<div class="tms-head"><span class="tms-big">' + big + '</span>' + (bigLabel ? '<span class="tms-big-label">' + bigLabel + '</span>' : '') + '</div>' +
      '<div class="tms-facts">' + rest + '</div></div>';
  }
  function fact(label, value, sub) {
    return '<div class="tms-fact"><span class="tms-k">' + label + '</span><span class="tms-v">' + value + '</span>' + (sub ? '<span class="tms-sub">' + sub + '</span>' : '') + '</div>';
  }
  function progress(label, right, pct) {
    return '<div class="tms-prog"><div class="tms-prog-top"><span class="tms-prog-name">' + label + '</span><span class="tms-k">' + right + '</span></div>' +
      '<div class="tms-bar"><span style="width:' + Math.max(2, Math.round(pct * 100)) + '%"></span></div></div>';
  }
  var TOD_PHRASE = { Morning: 'mornings', Midday: 'at midday', Evening: 'evenings', Night: 'nights' };
  function isDark() { return document.documentElement.classList.contains('rr-theme-dark'); }
  function railColor(rr) {
    try { return isDark() ? tripRailColorDark(rr) : tripRailColor(rr); } catch (_) { return isDark() ? '#8fd3ff' : '#07093e'; }
  }
  function ll(st) { return [+st.lat, +st.lon]; }
  function okLL(st) { return st && isFinite(+st.lat) && isFinite(+st.lon); }

  // ---- Route order for a line ----
  // Station lists are unordered and include branches. Snap each station to the line's track shapes:
  // the shape with the most stations is the trunk, read in order along it; stations off the trunk
  // form branches read along their own shape from the end nearest the trunk.
  function orderLine(L, s) {
    var polys = [];
    try { polys = rrGetCachedTripPolylines(L.rr, L.lid) || []; } catch (_) {}
    var pts = L.stations.filter(okLL), SNAP = 0.6;
    function along(pl, st) { return rrSnapToPolyline(+st.lat, +st.lon, pl); }
    var groups = [];
    if (polys.length) {
      var scored = polys.map(function (pl) {
        var snaps = pts.map(function (st) { return along(pl, st); });
        return { pl: pl, snaps: snaps, on: snaps.filter(function (x) { return x.dist <= SNAP; }).length };
      }).sort(function (a, b) { return b.on - a.on; });
      // Each station goes to the shape it sits closest to; shared stations stay on the trunk (or the earlier shape).
      var used = {}, buckets = scored.map(function () { return []; });
      pts.forEach(function (st, i) {
        var best = Infinity;
        scored.forEach(function (sc) { best = Math.min(best, sc.snaps[i].dist); });
        if (best > SNAP) return;
        for (var g = 0; g < scored.length; g++) {
          if (scored[g].snaps[i].dist <= best + 0.1) { buckets[g].push({ st: st, a: scored[g].snaps[i].along }); used[st.id] = 1; return; }
        }
      });
      buckets.forEach(function (mine) {
        if (!mine.length) return;
        mine.sort(function (x, y) { return x.a - y.a; });
        groups.push(mine.map(function (m) { return m.st; }));
      });
      var rest = pts.filter(function (st) { return !used[st.id]; });
      if (rest.length) { var rg = byAxis(rest); rg.rest = true; groups.push(rg); }
    } else {
      groups.push(byAxis(pts));
    }
    // Trunk reads from the end nearer the station you use most; branches start at the end nearer the trunk.
    var fav = null, favN = -1;
    pts.forEach(function (st) { var n = s.endpoints[L.rr + ':' + st.id] || 0; if (n > favN) { favN = n; fav = st; } });
    var trunk = groups[0] || [];
    if (trunk.length > 1 && fav) {
      var dF = haversineMiles(+fav.lat, +fav.lon, +trunk[0].lat, +trunk[0].lon), dL = haversineMiles(+fav.lat, +fav.lon, +trunk[trunk.length - 1].lat, +trunk[trunk.length - 1].lon);
      if (dL < dF) trunk.reverse();
    }
    var branches = groups.slice(1).map(function (g) {
      if (g.length > 1) {
        var near = function (st) { return Math.min.apply(null, trunk.map(function (t) { return haversineMiles(+st.lat, +st.lon, +t.lat, +t.lon); })); };
        if (near(g[g.length - 1]) < near(g[0])) { var rest = g.rest; g.reverse(); g.rest = rest; }
      }
      return g;
    });
    return { trunk: trunk, branches: branches };
  }
  function byAxis(list) {
    if (list.length < 3) return list.slice();
    var a = list[0], far = a, fd = -1;
    list.forEach(function (st) { var d = haversineMiles(+a.lat, +a.lon, +st.lat, +st.lon); if (d > fd) { fd = d; far = st; } });
    return list.slice().sort(function (x, y) { return haversineMiles(+far.lat, +far.lon, +x.lat, +x.lon) - haversineMiles(+far.lat, +far.lon, +y.lat, +y.lon); });
  }
  function stState(s, rr, id) { return s.visitedPlaces[s.placeOf[rr + ':' + id]] ? 'is-end' : 'is-not'; }
  function diagramRows(s, L, list) {
    // Runs of 4 or more stations you haven't been to fold into one row.
    var out = [], run = [];
    function flush() {
      if (run.length >= 4) {
        out.push('<li class="tms-st is-fold"><button type="button" class="tms-fold" data-fold>' + run.length + ' stations not visited yet</button><ol class="tms-fold-list" hidden>' +
          run.map(function (st) { return row(st, 'is-not'); }).join('') + '</ol></li>');
      } else run.forEach(function (st) { out.push(row(st, 'is-not')); });
      run = [];
    }
    function row(st, cls) { return '<li class="tms-st ' + cls + '"><span class="tms-dot"></span><span class="tms-st-name">' + esc(shortName(st.name, L.rr, st.id)) + '</span></li>'; }
    list.forEach(function (st) {
      var c = stState(s, L.rr, st.id);
      if (c === 'is-not') { run.push(st); return; }
      flush(); out.push(row(st, c));
    });
    flush();
    return '<ol class="tms-diagram" style="--tms-rail:' + railColor(L.rr) + '">' + out.join('') + '</ol>';
  }
  function lineItem(s, L, i) {
    var o = L.order || { trunk: L.stations, branches: [] };
    var body = diagramRows(s, L, o.trunk) + o.branches.map(function (b) {
      var end = b[b.length - 1];
      return '<div class="tms-branch-h">' + (b.rest ? 'Other stations on this line' : b.length > 1 ? 'Branch: ' + esc(shortName(b[0].name, L.rr, b[0].id)) + ' to ' + esc(shortName(end.name, L.rr, end.id)) : 'Branch: ' + esc(shortName(end && end.name, L.rr, end && end.id))) + '</div>' + diagramRows(s, L, b);
    }).join('');
    return '<li class="tms-lineitem' + (i >= 4 ? ' is-extra' : '') + '"' + (i >= 4 ? ' hidden' : '') + '>' +
      '<button type="button" class="tms-linebtn" aria-expanded="false" data-line="' + esc(L.key) + '" style="--tms-rail:' + railColor(L.rr) + '">' +
      '<span class="tms-prog-top"><span class="tms-prog-name">' + esc(L.name) + '</span><span class="tms-k">' + L.got + ' of ' + L.total +
      '<svg class="tms-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span>' +
      '<span class="tms-bar"><span style="width:' + Math.max(2, Math.round(L.pct * 100)) + '%"></span></span></button>' +
      '<div class="tms-linebody" hidden>' + body + '</div></li>';
  }
  var MS_MAP = null;
  function drawMap(s) {
    var el = document.getElementById('tms-map');
    if (!el || typeof L === 'undefined') return;
    if (MS_MAP) { try { MS_MAP.remove(); } catch (_) {} MS_MAP = null; }
    var map = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    try { rrTripMapTileLayer({ maxZoom: 18, opacity: 0.85 }).addTo(map); } catch (_) {}
    L.control.zoom({ position: 'topright' }).addTo(map);
    var bounds = [], layers = {};
    s.lineList.forEach(function (Ln) {
      var col = railColor(Ln.rr), grp = L.layerGroup().addTo(map);
      layers[Ln.key] = grp;
      var polys = []; try { polys = rrGetCachedTripPolylines(Ln.rr, Ln.lid) || []; } catch (_) {}
      polys.forEach(function (pl) { var p = L.polyline(pl, { color: col, weight: 2, opacity: 0.35, interactive: false }).addTo(grp); p.__tmsBase = { opacity: 0.35 }; });
    });
    var drawn = {};
    // Not yet visited, then passed, then boarded or got off, so the important dots sit on top.
    ['is-not', 'is-end'].forEach(function (want) {
      s.lineList.forEach(function (Ln) {
        var col = railColor(Ln.rr);
        Ln.stations.forEach(function (st) {
          var k = s.placeOf[Ln.rr + ':' + st.id], c = stState(s, Ln.rr, st.id);
          if (c !== want || drawn[k] || !okLL(st)) return;
          drawn[k] = 1;
          var opt = c === 'is-end' ? { radius: 5.5, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }
            : { radius: 3, color: col, weight: 1.2, opacity: 0.55, fillColor: '#fff', fillOpacity: 0.9 };
          var m = L.circleMarker(ll(st), opt).addTo(layers[Ln.key]);
          m.__tmsBase = { opacity: opt.opacity == null ? 1 : opt.opacity, fillOpacity: opt.fillOpacity };
          m.bindTooltip(esc(shortName(st.name, Ln.rr, st.id)), { direction: 'top', offset: [0, -4] });
          if (c !== 'is-not') bounds.push(ll(st));
        });
      });
    });
    // Start on where most of your riding is (within 80 mi of your most used station), with a way to see everything.
    var fav = null, favN = 0;
    Object.keys(s.endpoints).forEach(function (k) { if (s.endpoints[k] > favN) { favN = s.endpoints[k]; var i = k.indexOf(':'); fav = findTripStation(k.slice(0, i), k.slice(i + 1)); } });
    var home = bounds;
    if (okLL(fav)) {
      var core = bounds.filter(function (b) { return haversineMiles(+fav.lat, +fav.lon, b[0], b[1]) <= 80; });
      if (core.length >= bounds.length * 0.7 && core.length < bounds.length) home = core;
    }
    if (home.length) map.fitBounds(home, { padding: [18, 18], maxZoom: 12 }); else map.setView([42.36, -71.06], 9);
    if (home !== bounds) {
      var allBtn = L.control({ position: 'bottomleft' });
      allBtn.onAdd = function () {
        var b = L.DomUtil.create('button', 'tms-map-all'); b.type = 'button'; b.textContent = 'Show all stations';
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener('click', function () { map.fitBounds(bounds, { padding: [18, 18], maxZoom: 12 }); });
        return b;
      };
      allBtn.addTo(map);
    }
    MS_MAP = { map: map, layers: layers, home: home };
  }
  function focusLine(key) {
    if (!MS_MAP || !MS_TRIPS) return;
    // The open line stays bright; the others fade.
    Object.keys(MS_MAP.layers).forEach(function (k) {
      MS_MAP.layers[k].eachLayer(function (lay) {
        var b = lay.__tmsBase; if (!b || !lay.setStyle) return;
        var dim = key && k !== key;
        lay.setStyle(dim ? { opacity: b.opacity * 0.25, fillOpacity: b.fillOpacity == null ? undefined : b.fillOpacity * 0.25 } : b);
        if (!dim && key && lay.bringToFront) lay.bringToFront();
      });
    });
    var Ln = (MS_LAST && MS_LAST.lineList || []).filter(function (l) { return l.key === key; })[0];
    if (!Ln) { if (MS_MAP.home.length) MS_MAP.map.fitBounds(MS_MAP.home, { padding: [18, 18], maxZoom: 12 }); return; }
    var b = Ln.stations.filter(okLL).map(ll);
    if (b.length) MS_MAP.map.fitBounds(b, { padding: [18, 18], maxZoom: 12 });
  }
  var MS_LAST = null;
  function render(s) {
    var body = document.getElementById('trip-more-stats-body');
    if (!body) return;
    MS_LAST = s;
    if (!s.trips) { body.innerHTML = '<p class="tms-empty">Stats appear after your first trip.</p>'; return; }
    // Exploring: map plus line diagrams.
    var places = s.stations;
    var legend = '<div class="tms-legend"><span><i class="tms-key is-end"></i>Boarded or got off</span><span><i class="tms-key is-not"></i>Not yet</span></div>';
    var lines = s.lineList.map(function (Ln, i) { return lineItem(s, Ln, i); }).join('');
    var more = s.lineList.length > 4 ? '<button type="button" class="tms-more-lines" data-more-lines>Show all ' + s.lineList.length + ' lines</button>' : '';
    var explore = '<section class="tms-card tms-explore"><div class="tms-explore-head"><div><h3 class="tms-label">Exploring</h3>' +
      '<div class="tms-head"><span class="tms-big">' + places.toLocaleString() + '</span><span class="tms-big-label">' + (places === 1 ? 'station visited' : 'stations visited') + '</span></div></div>' + legend + '</div>' +
      '<div class="tms-explore-body"><div class="tms-map-wrap"><div id="tms-map" class="tms-map" role="img" aria-label="Map of stations you have visited"></div></div>' +
      '<div class="tms-lines"><ul class="tms-linelist">' + lines + '</ul>' + more + '</div></div></section>';
    // Time on trains
    var longFacts = '';
    if (s.longDist && s.longTime && s.longDist.t === s.longTime.t) {
      longFacts = fact('Longest trip', fmtMi(s.longDist.v), routeText(s.longDist.t) + ' in ' + fmtDur(s.longTime.v));
    } else {
      if (s.longDist) longFacts += fact('Longest by distance', fmtMi(s.longDist.v), routeText(s.longDist.t));
      if (s.longTime) longFacts += fact('Longest by time', fmtDur(s.longTime.v), routeText(s.longTime.t));
    }
    if ((s.timedTrips || 0) > 1) longFacts += fact('Average trip', fmtDur(Math.round(s.minutes / s.timedTrips)));
    var c1 = card('Time on trains', fmtDur(s.minutes), 'on board', longFacts);
    // Patterns
    var combo = {}, top = null;
    (s.combos || []).forEach(function (c) { combo[c] = (combo[c] || 0) + 1; if (!top || combo[c] > combo[top]) top = c; });
    var sentence = top ? 'Usually ' + DOW[+top.split('|')[0]] + ' ' + TOD_PHRASE[top.split('|')[1]] : 'No pattern yet';
    var counts = s.months.map(function (m) { return m.n; }), maxM = Math.max.apply(null, counts), maxI = counts.lastIndexOf(maxM);
    var bars = s.months.map(function (m, i) {
      var h = m.n ? Math.max(8, Math.round(m.n / Math.max(1, maxM) * 100)) : 0, isMax = i === maxI && maxM;
      return '<div class="tms-col' + (isMax ? ' is-max' : '') + '" title="' + m.label + ' ' + m.year + ': ' + m.n + (m.n === 1 ? ' trip' : ' trips') + '">' +
        (isMax ? '<span class="tms-col-n">' + maxM + ' in ' + m.label + '</span>' : '') + '<span class="tms-col-bar" style="height:' + h + '%"></span></div>';
    }).join('');
    var axis = '<div class="tms-axis"><span>' + s.months[0].label + '</span><span>' + s.months[s.months.length - 1].label + '</span></div>';
    var c3 = card('Patterns', sentence, '', fact('Longest streak', s.longestStreak + (s.longestStreak === 1 ? ' day' : ' days')) +
      '<div class="tms-chart-wrap"><span class="tms-k">Trips per month</span><div class="tms-chart" role="img" aria-label="Trips per month for the last 12 months, most in ' + s.months[maxI].label + ' with ' + maxM + '">' + bars + '</div>' + axis + '</div>');
    // Milestones
    var earned = [], next = [], total = 0;
    MILESTONES.forEach(function (g) {
      var have = g.key === 'miles' ? Math.floor(s.miles) : g.key === 'stations' ? places : s[g.key], nx = null;
      total += g.steps.length;
      g.steps.forEach(function (n) { if (have >= n) earned.push(g.label(n)); else if (nx == null) nx = n; });
      if (nx == null) return;
      var near = g.key === 'linesDone' && !have ? s.lineList.filter(function (l) { return l.total && l.got < l.total; })[0] : null;
      next.push({ label: g.label(nx), pct: near ? near.got / near.total : Math.min(1, have / nx),
        right: near ? (near.total - near.got) + ' to go on ' + esc(near.name) : have.toLocaleString() + ' of ' + nx.toLocaleString() });
    });
    next.sort(function (a, b) { return b.pct - a.pct; });
    var c4 = card('Milestones', earned.length + ' of ' + total, 'earned',
      (next.length ? '<span class="tms-k tms-mini-h">Up next</span>' + next.slice(0, 3).map(function (n) { return progress(esc(n.label), n.right, n.pct); }).join('') : '') +
      (earned.length ? '<details class="tms-earned"><summary>Show earned</summary><div class="tms-chips">' +
        earned.map(function (l) { return '<span class="tms-chip">' + esc(l) + '</span>'; }).join('') + '</div></details>' : ''));
    var notes = [];
    if (s.upcoming) notes.push('Counts the ' + s.trips + ' trips you\u2019ve taken. ' + (s.upcoming === 1 ? 'Your upcoming trip is' : 'Your ' + s.upcoming + ' upcoming trips are') + ' added once ' + (s.upcoming === 1 ? 'it departs.' : 'they depart.'));
    body.innerHTML = explore + '<div class="tms-row3">' + c1 + c3 + c4 + '</div>' + notes.map(function (n) { return '<p class="tms-note">' + n + '</p>'; }).join('');
    wire(body);
    drawMap(s);
  }
  function wire(body) {
    if (body.__tmsWired) return;
    body.__tmsWired = true;
    body.addEventListener('click', function (e) {
      var lb = e.target.closest('.tms-linebtn');
      if (lb) {
        var open = lb.getAttribute('aria-expanded') !== 'true';
        body.querySelectorAll('.tms-linebtn[aria-expanded="true"]').forEach(function (b) { if (b !== lb) { b.setAttribute('aria-expanded', 'false'); b.nextElementSibling.hidden = true; } });
        lb.setAttribute('aria-expanded', open ? 'true' : 'false');
        lb.nextElementSibling.hidden = !open;
        focusLine(open ? lb.getAttribute('data-line') : null);
        return;
      }
      var f = e.target.closest('[data-fold]');
      if (f) { f.nextElementSibling.hidden = false; f.parentNode.classList.add('is-open'); f.remove(); return; }
      var m = e.target.closest('[data-more-lines]');
      if (m) { body.querySelectorAll('.tms-lineitem.is-extra').forEach(function (li) { li.hidden = false; }); m.remove(); }
    });
  }
  // Track shapes give route order; load them for your lines before drawing (bounded wait).
  async function withOrder(s) {
    var keys = {};
    s.lineList.forEach(function (Ln) { keys[Ln.rr + '|' + Ln.lid] = Ln; });
    try {
      await Promise.race([Promise.all(Object.keys(keys).map(function (k) { var Ln = keys[k]; return Promise.resolve(ensureTripShapesForMiles(Ln.rr, Ln.lid)).catch(function () { return null; }); })),
        new Promise(function (r) { setTimeout(r, 5000); })]);
    } catch (_) {}
    s.lineList.forEach(function (Ln) { try { Ln.order = orderLine(Ln, s); } catch (_) { Ln.order = null; } });
    return s;
  }
  async function load() {
    if (MS_TRIPS) return MS_TRIPS;
    if (MS_LOADING) return MS_LOADING;
    var user = (typeof rrAuthUser === 'function') ? rrAuthUser() : currentUser;
    if (!user) return [];
    MS_LOADING = fetchAllUserTripLogs(user.uid).then(function (r) { MS_TRIPS = r.trips || []; MS_LOADING = null; return MS_TRIPS; },
      function (e) { MS_LOADING = null; throw e; });
    return MS_LOADING;
  }
  async function refresh() {
    var body = document.getElementById('trip-more-stats-body');
    if (!body) return;
    if (!MS_TRIPS) body.innerHTML = '<p class="tms-empty">Loading stats</p>';
    try {
      var trips = await load();
      render(await withOrder(compute(trips)));
    }
    catch (e) { body.innerHTML = '<p class="tms-empty">Stats could not load. Try again later.</p>'; }
  }
  function mount() {
    var card = document.getElementById('trip-log-stats') || document.querySelector('.trip-log-stats');
    if (!card || document.getElementById('trip-more-stats')) return;
    var foot = document.createElement('div');
    foot.className = 'trip-log-stat-more';
    foot.innerHTML = '<button type="button" class="tms-toggle" id="trip-more-stats-btn" aria-expanded="false" aria-controls="trip-more-stats">More stats' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    card.appendChild(foot);
    var panel = document.createElement('section');
    panel.id = 'trip-more-stats';
    panel.className = 'trip-more-stats';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'More stats');
    panel.innerHTML = '<div id="trip-more-stats-body"></div>';
    card.parentNode.insertBefore(panel, card.nextSibling);
    var btn = foot.querySelector('button');
    btn.addEventListener('click', function () {
      MS_OPEN = panel.hidden;
      panel.hidden = !MS_OPEN;
      btn.setAttribute('aria-expanded', MS_OPEN ? 'true' : 'false');
      btn.firstChild.nodeValue = MS_OPEN ? 'Fewer stats' : 'More stats';
      if (MS_OPEN) refresh();
    });
  }
  // Saving or deleting a trip repaints the summary stats; drop the cached list and rebuild if the panel is open.
  window.rrMoreStatsInvalidate = function () { MS_TRIPS = null; if (MS_OPEN) refresh(); };
  var origPaint = window.paintTripLogStats;
  window.paintTripLogStats = function (stats) { var r = origPaint.apply(this, arguments); try { window.rrMoreStatsInvalidate(); } catch (_) {} return r; };
  // Device/Light/Dark switches change the rail colours; redraw an open panel from the last numbers.
  try {
    var wasDark = isDark();
    new MutationObserver(function () {
      var d = isDark();
      if (d === wasDark) return;
      wasDark = d;
      if (MS_OPEN && MS_LAST) render(MS_LAST);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  } catch (_) {}
  window.rrMoreStatsCompute = compute;
  window.rrMoreStatsMount = mount;
  mount();
})();
