/* 24-Hour Train Replay (live map). Plays back the last 24 hours of train positions with a time slider (Play/Pause,
   1x/10x/60x/300x, Jump To a time). Speed is part of the replay: each marker's tag and popup show the speed at that
   moment. Feeds that report speed (Amtrak, VIA, MBTA when it sends one) show "Reported"; the others (Metro-North, LIRR,
   Metra) show "Derived" speed from consecutive positions (haversine over the vehicle report times, skip an unchanged
   report time, 30 s to 6 min apart, drop anything over 150 mph).
   Data: railroadradar-replay Worker, GET /api/replay/hour?h=<UTC hour = epoch ms / 3600000>&rr=<railroads in view>.
   Commuter railroads are sampled every 30 s, Amtrak and VIA every 60 s. One hour is loaded at a time (the next hour is
   prefetched while playing); completed hours are edge cached. Only public train positions are involved.
   ?replaySample=1 (tests) swaps the network for made-up sample hours built from the trains on the map. */
(function () {
  'use strict';
  var API = 'https://railroadradar-replay.railroadradar.workers.dev/api/replay/hour';
  var SPAN_S = 24 * 3600;          // replay window
  var RATES = [1, 10, 60, 300];
  var NAVY = '#07093e', ACELA = '#00B3E3';
  var STEP = { mbta: 30, mnr: 30, lirr: 30, metra: 30, amtrak: 60, via: 60 };
  var AGENCY = { amtrak: 'Amtrak', via: 'VIA Rail', mbta: 'MBTA', mnr: 'Metro-North', lirr: 'LIRR', metra: 'Metra' };
  // Rough service areas [south, west, north, east]; a railroad loads only when its area overlaps the map view.
  var AREA = { mbta: [41.2, -72.2, 43.3, -69.8], mnr: [40.6, -74.4, 41.9, -72.7], lirr: [40.5, -74.1, 41.2, -71.8],
               metra: [41.1, -88.7, 42.7, -87.3], via: [41.5, -128, 60, -52], amtrak: [24, -125, 50, -66] };
  var MAX_GAP_S = 200;             // hide a train when its nearest sample is older than this

  var SAMPLE = (function () { try { return !!window.rrReplaySample || /[?&]replaySample=1(&|$)/.test(location.search); } catch (_) { return false; } })();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function hash(str) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function clockLabel(ms, withSec) {
    return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: withSec ? '2-digit' : undefined, timeZone: 'America/New_York' });
  }
  function dayLabel(ms) {
    return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  }
  function haversineMi(a, b) {
    var R = 3958.8, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  // ---- Sample hours (?replaySample=1 only) ----
  // Each train runs a repeating stop → speed up → cruise → slow down cycle back and forth along a short stretch,
  // ending at its current map spot. Encoded in the same text format the Worker returns.
  var REPORTS_SPEED = { 'Amtrak': true, 'VIA Rail': true, 'MBTA': true };
  var RR_OF = { 'Amtrak': 'amtrak', 'VIA Rail': 'via', 'MBTA': 'mbta', 'MNR': 'mnr', 'LIRR': 'lirr', 'Metra': 'metra' };
  var REPORTS_SPEED = { 'Amtrak': true, 'VIA Rail': true, 'MBTA': true };
  function makeTrack(row, endS) {
    var h = hash(row.id);
    var acela = /acela/i.test(String(row.routeName || ''));
    var intercity = row.agency === 'Amtrak' || row.agency === 'VIA Rail';
    var cruise = acela ? 125 + (h % 26) : intercity ? 55 + (h % 45) : 35 + (h % 30);   // mph
    var P = (intercity ? 26 : 12) * 60 + (h % 7) * 60;                                  // cycle seconds
    var dwell = 60 + (h % 3) * 30, ramp = acela ? 240 : 120;
    var cruiseS = Math.max(60, P - dwell - 2 * ramp);
    var v = cruise / 3600;                                                              // miles per second
    var cycleMi = v * (ramp + cruiseS);                                                 // 2 ramps at half speed
    var bearing = (h % 360) * Math.PI / 180;
    var L = Math.max(3, Math.min(cycleMi * 2, intercity ? 14 : 6));                    // stretch length, miles
    var off = (h >>> 8) % P;
    function speedAt(t) {
      var c = ((t + off) % P + P) % P;
      if (c < dwell) return 0;
      c -= dwell;
      if (c < ramp) return cruise * c / ramp;
      c -= ramp;
      if (c < cruiseS) return cruise;
      c -= cruiseS;
      return c < ramp ? cruise * (1 - c / ramp) : 0;
    }
    function distAt(t) {
      var tt = t + off, n = Math.floor(tt / P), c = tt - n * P, d = n * cycleMi;
      if (c <= dwell) return d; c -= dwell;
      if (c < ramp) return d + 0.5 * v * c * c / ramp;
      d += 0.5 * v * ramp; c -= ramp;
      if (c < cruiseS) return d + v * c;
      d += v * cruiseS; c -= cruiseS;
      return d + v * (c - 0.5 * c * c / ramp);
    }
    function along(t) { var m = ((distAt(t) % (2 * L)) + 2 * L) % (2 * L); return m <= L ? m : 2 * L - m; }   // back and forth
    var lat0 = Number(row.lat), lng0 = Number(row.lng), sEnd = along(endS);
    var cosLat = Math.cos(lat0 * Math.PI / 180) || 1;
    function posAt(t) {
      var s = along(t) - sEnd;
      return [lat0 + (s * Math.cos(bearing)) / 69.0, lng0 + (s * Math.sin(bearing)) / (69.0 * cosLat)];
    }
    return { row: row, acela: acela, reported: !!REPORTS_SPEED[row.agency], speedAt: speedAt, posAt: posAt };
  }
  var sampleTracks = null;
  function sampleHour(h, rrs) {
    if (!sampleTracks) {
      var rows = [];
      try { rows = window.rrCollectLiveTrainRows() || []; } catch (_) {}
      sampleTracks = rows.filter(function (r) { return isFinite(Number(r.lat)) && Number(r.lat) !== 0 && RR_OF[r.agency]; })
        .map(function (r) { return makeTrack(r, 0); });
    }
    var out = { h: h, rr: {} }, nowS = Date.now() / 1000;
    rrs.forEach(function (rr) {
      var ts = sampleTracks.filter(function (t) { return RR_OF[t.row.agency] === rr; });
      if (!ts.length) return;
      var ids = ts.map(function (t) { return t.row.id + '\t' + (t.row.trainNum || t.row.id) + '\t' + (t.row.routeName || ''); }).join('\n');
      var data = '';
      for (var sec = 0; sec < 3600; sec += STEP[rr]) {
        var abs = h * 3600 + sec; if (abs > nowS) break;
        var rel = abs - nowS;
        data += sec + '|' + ts.map(function (t, i) {
          var p = t.posAt(rel), mph = t.reported ? Math.round(t.speedAt(rel)) : '';
          return i + ',' + Math.round(p[0] * 1e5) + ',' + Math.round(p[1] * 1e5) + ',' + mph + ',,0';
        }).join(';') + '\n';
      }
      out.rr[rr] = { ids: ids, data: data };
    });
    return Promise.resolve(out);
  }

  // ---- Real hours ----
  var hours = {};                  // 'h|rr' → parsed hour, or 'loading' / 'error'
  var inflight = {};
  function parseHour(h, rr, blob) {
    var trains = (blob.ids || '').split('\n').map(function (line) {
      var p = line.split('\t'); return { key: p[0], label: p[1] || p[0], route: p[2] || '' };
    });
    var times = [], samples = [];
    (blob.data || '').split('\n').forEach(function (line) {
      if (!line) return;
      var bar = line.indexOf('|'), t = (h * 3600 + Number(line.slice(0, bar))) * 1000, m = {};
      line.slice(bar + 1).split(';').forEach(function (rec) {
        if (!rec) return;
        var f = rec.split(',');
        m[f[0]] = [Number(f[1]) / 1e5, Number(f[2]) / 1e5, f[3] === '' ? null : Number(f[3]), f[4] === '' ? null : Number(f[4]), f[5] === '' ? null : Number(f[5])];
      });
      times.push(t); samples.push(m);
    });
    return { h: h, rr: rr, trains: trains, times: times, samples: samples };
  }
  function load(h, rrs) {
    var need = rrs.filter(function (rr) { var v = hours[h + '|' + rr]; return !v || v === 'error'; }).sort();
    if (!need.length) return;
    var key = h + '|' + need.join(',');
    if (inflight[key]) return;
    need.forEach(function (rr) { hours[h + '|' + rr] = 'loading'; });
    inflight[key] = true;
    var p = SAMPLE ? sampleHour(h, need)
      : fetch(API + '?h=' + h + '&rr=' + need.join(','), { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    p.then(function (j) {
      need.forEach(function (rr) { hours[h + '|' + rr] = parseHour(h, rr, (j.rr && j.rr[rr]) || {}); });
      // The current hour keeps growing; let it reload after a minute.
      if (h >= Math.floor(Date.now() / 3600000)) setTimeout(function () { need.forEach(function (rr) { if (hours[h + '|' + rr] && hours[h + '|' + rr].h === h) hours[h + '|' + rr].stale = true; }); }, 60000);
    }, function () {
      need.forEach(function (rr) { hours[h + '|' + rr] = 'error'; });
    }).then(function () { delete inflight[key]; render(); });
  }
  function railroadsInView() {
    var b = map.getBounds();
    return Object.keys(AREA).filter(function (rr) {
      var a = AREA[rr];
      return !(b.getNorth() < a[0] || b.getSouth() > a[2] || b.getEast() < a[1] || b.getWest() > a[3]);
    });
  }
  function hourData(h, rr) { var v = hours[h + '|' + rr]; return v && typeof v === 'object' ? v : null; }
  // Last sample index with time <= t, or -1.
  function bsearch(times, t) { var lo = 0, hi = times.length - 1, ans = -1; while (lo <= hi) { var mid = (lo + hi) >> 1; if (times[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; } return ans; }
  // Walk samples backwards across the hour boundary: returns [{t, rec}] for one train, newest first, up to `max`.
  function history(rr, h, k, key, max, sinceMs) {
    var out = [], d = hourData(h, rr);
    while (d && out.length < max) {
      var ii = d._idx || (d._idx = (function () { var m = {}; d.trains.forEach(function (tr, i) { m[tr.key] = String(i); }); return m; })());
      var i = ii[key];
      for (; k >= 0 && out.length < max; k--) {
        if (d.times[k] < sinceMs) return out;
        var rec = i != null ? d.samples[k][i] : null;
        if (rec) out.push({ t: d.times[k], rec: rec });
      }
      h -= 1; d = hourData(h, rr); k = d ? d.times.length - 1 : -1;
    }
    return out;
  }
  // Derived speed: newest report vs. the latest earlier report 30 s – 6 min older (report time = sample − age).
  function derivedMph(rr, h, k, key) {
    var hist = history(rr, h, k, key, 16, 0);
    if (!hist.length) return null;
    var a = hist[0], ta = a.t - (a.rec[4] || 0) * 1000;
    for (var j = 1; j < hist.length; j++) {
      var b = hist[j], tb = b.t - (b.rec[4] || 0) * 1000, dt = (ta - tb) / 1000;
      if (dt <= 0) continue;                // same report seen again
      if (dt < 30) continue;
      if (dt > 360) return null;
      var mph = haversineMi([b.rec[0], b.rec[1]], [a.rec[0], a.rec[1]]) / (dt / 3600);
      return mph <= 150 ? Math.round(mph) : null;
    }
    return null;
  }

  // ---- State ----
  var map, layer, replayMarkers = {}, openId = null, statusEl;
  var endMs = 0, startMs = 0, cur = SPAN_S, playing = false, rate = 60, lastFrame = 0, raf = 0, bar, active = false;

  function displayNum(rr, label) { return rr === 'via' ? String(label).replace(/^v/i, '') : String(label); }
  function routeName(rr, route) {
    if (rr === 'mbta') return /^CR-/.test(route) ? route.slice(3).replace(/([a-z])([A-Z])/g, '$1 $2') + ' Line' : route;
    if (rr === 'mnr' || rr === 'lirr') return '';      // numeric GTFS route ids, not names
    return route;
  }
  function isAcela(v) { return v.rr === 'amtrak' && /acela/i.test(v.route); }
  function speedOf(v) {
    if (v.rec[2] != null) return { mph: Math.round(v.rec[2]), kind: 'Reported' };
    return { mph: derivedMph(v.rr, v.h, v.k, v.key), kind: 'Derived' };
  }
  function iconFor(v, sp) {
    var spd = sp.mph == null ? '—' : sp.mph + ' mph';
    return L.divIcon({
      className: 'rr-replay-mk', iconSize: [14, 14], iconAnchor: [7, 7],
      html: '<span class="rr-replay-dot" style="background:' + (isAcela(v) ? ACELA : NAVY) + '"></span>' +
            '<span class="rr-replay-tag"><b>' + esc(displayNum(v.rr, v.label)) + '</b> ' + esc(spd) + '</span>'
    });
  }
  function popupHtml(v) {
    var sp = speedOf(v), when = v.t, route = routeName(v.rr, v.route), num = displayNum(v.rr, v.label);
    var head = isAcela(v) ? ' style="--rr-head-bg:' + ACELA + ';" data-rr-head-tone="dark" data-rr-head-forced' : ' style="--rr-head-bg:' + NAVY + ';" data-rr-head-tone="dark"';
    return '<div class="train-popup rr-replay-popup">' +
      '<div class="train-popup-header"' + head + '><div>' +
        '<span class="rr-popup-head-rr">' + esc(AGENCY[v.rr]) + '</span> ' +
        '<span style="font-weight:700;color:#fff;font-style:italic;">' + esc(route ? route + ' ' + num : 'Train ' + num) + '</span>' +
      '</div></div>' +
      '<div class="train-popup-body">' +
        (SAMPLE ? '<div class="rr-replay-sample">Sample Data — Replay Test</div>' : '') +
        '<div class="rr-replay-speed"><span class="rr-replay-speed-num">' + (sp.mph == null ? '—' : sp.mph) + '</span>' +
          '<span class="rr-replay-speed-unit">mph</span><span class="rr-replay-speed-kind">' + sp.kind + ' Speed</span></div>' +
        '<div class="info-grid">' +
          '<div class="info-item"><span class="info-label">Replay Time</span><span class="info-value">' + esc(clockLabel(when, true)) + '</span></div>' +
          '<div class="info-item"><span class="info-label">Date</span><span class="info-value">' + esc(dayLabel(when)) + '</span></div>' +
          '<div class="info-item"><span class="info-label">Train</span><span class="info-value">' + esc(num) + '</span></div>' +
          '<div class="info-item"><span class="info-label">Route</span><span class="info-value">' + esc(route || '—') + '</span></div>' +
        '</div>' +
        '<div class="meta-row rr-replay-note">' + (sp.kind === 'Derived' ? 'Derived From Position Changes Between Reports' : 'Reported By The Railroad Feed') + '</div>' +
      '</div></div>';
  }

  // Every train of the railroads in view at time tMs, interpolated between its samples.
  function trainsAt(tMs, rrs) {
    var out = [], h = Math.floor(tMs / 3600000), nowH = Math.floor(Date.now() / 3600000), loading = false, failed = false, any = false;
    rrs.forEach(function (rr) {
      var hv = hours[h + '|' + rr];
      if (!hv || hv === 'error' || (hv.stale && h >= nowH - 1)) load(h, rrs);
      if (hv === 'loading' || !hv) loading = true;
      if (hv === 'error') failed = true;
      if (playing && h + 1 <= nowH && !hours[(h + 1) + '|' + rr]) load(h + 1, rrs);
      var d = hourData(h, rr), dh = h, k = d ? bsearch(d.times, tMs) : -1;
      if (k < 0) {                        // before this hour's first sample: use the previous hour's last one
        var pd = hourData(h - 1, rr); if (!pd) { if (!hours[(h - 1) + '|' + rr] && d) load(h - 1, rrs); return; }
        d = pd; dh = h - 1; k = d.times.length - 1; if (k < 0) return;
      }
      if (tMs - d.times[k] > MAX_GAP_S * 1000) return;
      any = true;
      var nd = d, nk = k + 1;
      if (nk >= d.times.length) { nd = hourData(dh + 1, rr); nk = 0; }
      var nextS = nd && nd.times.length > nk ? nd.samples[nk] : null, nextT = nextS ? nd.times[nk] : 0;
      var idx = d._idx || (d._idx = (function () { var m = {}; d.trains.forEach(function (tr, i) { m[tr.key] = String(i); }); return m; })());
      var nidx = nd && (nd._idx || (nd._idx = (function () { var m = {}; nd.trains.forEach(function (tr, i) { m[tr.key] = String(i); }); return m; })()));
      var s = d.samples[k];
      for (var i in s) {
        var tr = d.trains[i]; if (!tr) continue;
        var rec = s[i], lat = rec[0], lon = rec[1];
        if (nextS && nextT - d.times[k] <= 2 * STEP[rr] * 1000 + 5000) {
          var j = nidx && nidx[tr.key], nr = j != null ? nextS[j] : null;
          if (nr) { var f = (tMs - d.times[k]) / (nextT - d.times[k]); lat += (nr[0] - lat) * f; lon += (nr[1] - lon) * f; }
        }
        out.push({ id: rr + ':' + tr.key, rr: rr, key: tr.key, label: tr.label, route: tr.route, rec: rec, h: dh, k: k, t: d.times[k], lat: lat, lon: lon });
      }
    });
    return { trains: out, loading: loading, failed: failed, any: any };
  }

  function render() {
    if (!active) return;
    var tMs = startMs + cur * 1000, rrs = railroadsInView(), res = trainsAt(tMs, rrs);
    var b = map.getBounds().pad(0.2), seen = {};
    res.trains.forEach(function (v) {
      var ll = [v.lat, v.lon];
      if (!b.contains(ll) && openId !== v.id) return;
      seen[v.id] = true;
      var mk = replayMarkers[v.id], sp = speedOf(v), skey = sp.mph + '|' + sp.kind + '|' + v.label;
      if (!mk) {
        mk = L.marker(ll, { icon: iconFor(v, sp), pane: 'rrReplay', keyboard: false });
        mk._rrKey = skey; mk._rrV = v;
        var narrow = map.getSize().x < 520;
        mk.bindPopup('', { className: 'rr-replay-leaflet-popup', maxWidth: narrow ? 260 : 300, minWidth: narrow ? 220 : 240, autoPanPaddingTopLeft: [10, 70], autoPanPaddingBottomRight: [10, 120] });
        mk.on('popupopen', function (e) { openId = e.target._rrV.id; e.target._rrK = e.target._rrV.t; e.target.setPopupContent(popupHtml(e.target._rrV)); });
        mk.on('popupclose', function (e) { if (openId === e.target._rrV.id) openId = null; });
        layer.addLayer(mk);
        replayMarkers[v.id] = mk;
      } else {
        mk._rrV = v;
        mk.setLatLng(ll);
        if (mk._rrKey !== skey) { mk._rrKey = skey; mk.setIcon(iconFor(v, sp)); }
      }
      if (openId === v.id && mk.isPopupOpen() && mk._rrK !== v.t) { mk._rrK = v.t; mk.setPopupContent(popupHtml(v)); }
    });
    Object.keys(replayMarkers).forEach(function (id) {
      if (!seen[id]) { layer.removeLayer(replayMarkers[id]); delete replayMarkers[id]; if (openId === id) openId = null; }
    });
    if (statusEl) {
      var msg = res.trains.length ? '' : res.loading ? 'Loading Replay…' : res.failed ? 'Replay Data Unavailable' : !rrs.length ? '' : 'No Replay Data For This Time';
      statusEl.textContent = msg; statusEl.hidden = !msg;
    }
    updateBar();
  }

  // ---- Controls ----
  function updateBar() {
    if (!bar) return;
    var ms = startMs + cur * 1000;
    bar.querySelector('.rr-replay-clock').textContent = clockLabel(ms, false);
    bar.querySelector('.rr-replay-day').textContent = dayLabel(ms);
    var s = bar.querySelector('.rr-replay-slider');
    if (document.activeElement !== s) s.value = String(Math.round(cur));
    s.style.setProperty('--rr-fill', (cur / SPAN_S * 100).toFixed(2) + '%');
    var p = bar.querySelector('.rr-replay-play');
    p.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    p.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
    bar.querySelectorAll('.rr-replay-rate').forEach(function (btn) { btn.setAttribute('aria-pressed', String(Number(btn.dataset.rate) === rate)); });
  }
  function tick(ts) {
    if (!playing) return;
    if (lastFrame) {
      cur = Math.min(SPAN_S, cur + (ts - lastFrame) / 1000 * rate);
      if (cur >= SPAN_S) playing = false;
      render();
    }
    lastFrame = ts;
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    playing = !!on;
    if (playing && cur >= SPAN_S) cur = 0;
    lastFrame = 0; cancelAnimationFrame(raf);
    if (playing) raf = requestAnimationFrame(tick);
    updateBar();
  }
  function jumpTo(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); if (!m) return;
    var want = Number(m[1]) * 60 + Number(m[2]);
    // Latest moment in the window whose Eastern clock time is hh:mm.
    for (var s = SPAN_S; s >= 0; s -= 60) {
      var p = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' }).formatToParts(new Date(startMs + s * 1000));
      var hh = Number(p.find(function (x) { return x.type === 'hour'; }).value), mm = Number(p.find(function (x) { return x.type === 'minute'; }).value);
      if (hh * 60 + mm === want) { cur = s; render(); return; }
    }
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.className = 'rr-replay-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', '24-Hour Train Replay');
    bar.innerHTML =
      '<div class="rr-replay-row">' +
        '<button type="button" class="rr-replay-play" aria-label="Play"></button>' +
        '<div class="rr-replay-time"><span class="rr-replay-clock"></span><span class="rr-replay-day"></span></div>' +
        '<div class="rr-replay-rates" role="group" aria-label="Playback Speed">' +
          RATES.map(function (r) { return '<button type="button" class="rr-replay-rate" data-rate="' + r + '">' + r + 'x</button>'; }).join('') +
        '</div>' +
        '<label class="rr-replay-jump"><span>Jump To</span><input type="time" class="rr-replay-jump-in" aria-label="Jump To Time"></label>' +
        '<button type="button" class="rr-replay-close" aria-label="Close Replay">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>' +
      '</div>' +
      '<div class="rr-replay-row rr-replay-row-slider">' +
        '<span class="rr-replay-edge">24h Ago</span>' +
        '<input type="range" class="rr-replay-slider" min="0" max="' + SPAN_S + '" step="30" aria-label="Replay Time">' +
        '<span class="rr-replay-edge">Now</span>' +
      '</div>' +
      '<div class="rr-replay-status" role="status" hidden></div>' +
      (SAMPLE ? '<div class="rr-replay-sample-note">Sample Data — Replay Test</div>' : '');
    bar.querySelector('.rr-replay-play').addEventListener('click', function () { setPlaying(!playing); });
    bar.querySelectorAll('.rr-replay-rate').forEach(function (btn) {
      btn.addEventListener('click', function () { rate = Number(btn.dataset.rate); lastFrame = 0; updateBar(); });
    });
    bar.querySelector('.rr-replay-slider').addEventListener('input', function (e) { cur = Number(e.target.value); render(); });
    bar.querySelector('.rr-replay-jump-in').addEventListener('change', function (e) { jumpTo(e.target.value); });
    bar.querySelector('.rr-replay-close').addEventListener('click', stop);
    L.DomEvent.disableClickPropagation(bar); L.DomEvent.disableScrollPropagation(bar);
    statusEl = bar.querySelector('.rr-replay-status');
    map.getContainer().appendChild(bar);
  }

  function start() {
    if (active) return;
    endMs = Math.floor(Date.now() / 30000) * 30000;
    startMs = endMs - SPAN_S * 1000;
    active = true; cur = SPAN_S - 15 * 60; rate = 60;
    map.getContainer().classList.add('rr-replay-on');
    map.closePopup();
    if (!bar) buildBar(); else bar.hidden = false;
    btn && btn.setAttribute('aria-pressed', 'true');
    render();
    map.on('moveend', render);
    map.on('zoomend', zoomClass); zoomClass();
    window.rrReplay = api;
  }
  // Train number + speed tags only when zoomed in enough to read them; dots below that.
  function zoomClass() { map.getContainer().classList.toggle('rr-replay-tags', map.getZoom() >= 11); }
  function stop() {
    map.off('zoomend', zoomClass);
    setPlaying(false); active = false;
    map.off('moveend', render);
    layer.clearLayers(); replayMarkers = {}; openId = null;
    map.getContainer().classList.remove('rr-replay-on');
    if (bar) bar.hidden = true;
    btn && btn.setAttribute('aria-pressed', 'false');
  }

  var btn;
  var api = {
    start: start, stop: stop, play: function () { setPlaying(true); }, pause: function () { setPlaying(false); },
    seek: function (s) { cur = Math.max(0, Math.min(SPAN_S, s)); render(); }, setRate: function (r) { rate = r; updateBar(); },
    markers: function () { return replayMarkers; }, time: function () { return cur; },
    trains: function () { return active ? trainsAt(startMs + cur * 1000, railroadsInView()).trains : []; },
    loaded: function () { return Object.keys(hours).filter(function (k) { return typeof hours[k] === 'object'; }); }
  };

  function init() {
    map = window.rrMainMap;
    if (!map || !window.L || (SAMPLE && typeof window.rrCollectLiveTrainRows !== 'function')) return false;
    if (!map.getPane('rrReplay')) map.createPane('rrReplay').style.zIndex = 640;
    layer = L.layerGroup().addTo(map);
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rr-replay-open';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 5v5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9v4l3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Replay</span>';
    btn.setAttribute('aria-label', '24-Hour Train Replay');
    btn.addEventListener('click', function () { active ? stop() : start(); });
    L.DomEvent.disableClickPropagation(btn);
    map.getContainer().appendChild(btn);
    window.rrReplay = api;
    return true;
  }
  (function wait(n) { if (!init() && n < 200) setTimeout(function () { wait(n + 1); }, 100); })(0);
})();
