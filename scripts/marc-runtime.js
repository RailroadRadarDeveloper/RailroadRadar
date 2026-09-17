      const MARC_POSITIONS_URL = apiUrl('/api/marc/positions');
      const MARC_TRIPUPDATES_URL = apiUrl('/api/marc/tripupdates');
      const MARC_COLOR = '#FF8000';
      const MARC_STATIC = __MARC_STATIC_JSON__;
      const MARC_GTFS_RT_DESCRIPTOR = MNR_GTFS_RT_DESCRIPTOR;
      let marcFeedMessageType = null;
      function getMarcFeedMessageType() {
        if (marcFeedMessageType) return marcFeedMessageType;
        if (typeof protobuf === 'undefined' || !protobuf.Root) throw new Error('protobufjs not loaded');
        marcFeedMessageType = protobuf.Root.fromJSON(MARC_GTFS_RT_DESCRIPTOR).lookupType('transit_realtime.FeedMessage');
        return marcFeedMessageType;
      }
      function marcUnixToDate(t) {
        if (t == null || t === '') return null;
        let n = (typeof t === 'object' && t !== null && typeof t.toNumber === 'function') ? t.toNumber() : Number(t);
        if (!isFinite(n) || n <= 0) return null;
        if (n > 1e12) n = Math.floor(n / 1000);
        const d = new Date(n * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
      function marcFormatTime(d) {
        if (!d) return null;
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      function marcStopCoords(stopId) {
        const s = MARC_STATIC.stops[String(stopId || '')];
        if (!s || s.lat == null || s.lon == null) return null;
        return { lat: Number(s.lat), lon: Number(s.lon), name: s.name || String(stopId) };
      }
      function marcRouteInfo(routeId) {
        const r = MARC_STATIC.routes[String(routeId || '')] || null;
        return { id: String(routeId || ''), name: (r && r.name) || 'MARC', color: (r && r.color) || MARC_COLOR, text: (r && r.text) || '#FFFFFF' };
      }
      function marcEventTime(ev) { return ev ? marcUnixToDate(ev.time) : null; }
      function marcEventDelayMin(ev) {
        if (!ev || ev.delay == null) return null;
        const sec = Number(ev.delay);
        return isFinite(sec) ? Math.round(sec / 60) : null;
      }
      function marcBuildStopsFromTripUpdate(tu) {
        const now = Date.now();
        return ((tu && tu.stop_time_update) || []).map(function(stu) {
          const stopId = stu.stop_id != null ? String(stu.stop_id) : '';
          const staticStop = MARC_STATIC.stops[stopId] || null;
          const name = (staticStop && staticStop.name) || stopId || 'Unknown';
          const arr = marcEventTime(stu.arrival);
          const dep = marcEventTime(stu.departure);
          const primary = dep || arr;
          const delayMin = marcEventDelayMin(stu.departure);
          const delayMin2 = delayMin != null ? delayMin : marcEventDelayMin(stu.arrival);
          return {
            name: name, stopId: stopId, scheduledTime: primary, predictedTime: primary,
            delayMinutes: delayMin2, trackNumber: null,
            formattedScheduledTime: marcFormatTime(primary) || '\u2014',
            formattedPredictedTime: marcFormatTime(primary),
            formattedActualTime: null,
            isCompleted: primary ? primary.getTime() < now : false,
            lat: staticStop ? Number(staticStop.lat) : null,
            lng: staticStop ? Number(staticStop.lon) : null
          };
        });
      }
      function marcDisplayTrainNum(tripId, vehicleId) {
        const s = String(tripId || vehicleId || '').trim();
        const m = s.match(/(\d{2,4})\s*$/) || s.match(/Train\s*(\d+)/i);
        if (m) return m[1];
        return s.replace(/^Train/i, '') || '?';
      }
      function createMarcIcon() {
        return L.divIcon({
          className: 'marc-icon',
          html: '<div style="width:16px;height:16px;background:#FF8000;border:2px solid #ffffff;border-radius:50%;box-sizing:border-box;"></div>',
          iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8]
        });
      }
      function createMarcPopupContent(vid, info) {
        const num = info.trainNum || String(vid).replace(/^marc-/, '');
        const route = info.routeName || 'MARC';
        const dest = info.destName || '\u2014';
        const origin = info.origName || '\u2014';
        const status = info.statusText || 'On Time';
        const statusPillClass = info.statusPillClass || 'status-on-time';
        const speed = info.speedMph != null ? Math.round(Number(info.speedMph)) : null;
        const lastSeenTime = marcLastSeen[vid] ? new Date(marcLastSeen[vid]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '\u2014';
        const badge = '<span class="cape-badge" style="background:#FF8000;">MARC</span>';
        const refreshBtn = '<button class="popup-action-btn refresh-btn" onclick="refreshMarcTrain(\'' + vid + '\')">Refresh</button>';
        const shareBtn = (typeof rrShareTrainBtnHtml === 'function') ? rrShareTrainBtnHtml('marc', vid, num) : '';
        const hasAlert = !!info.hasAlert;
        const al = (typeof trainAlertBannerHtml === 'function') ? trainAlertBannerHtml(hasAlert, info.alertHeader) : '';
        const alertIcon = (typeof trainAlertHeaderIconHtml === 'function') ? trainAlertHeaderIconHtml(hasAlert) : '';
        const stopsHtml = (info.stops && info.stops.length) ? buildStopsHtml(info.stops, info.lat, info.lng) : '<div class="no-departures">No stop data</div>';
        let statusDesc = 'On the way to ' + dest;
        if (info.vehicleStatus === 1 && info.currentStopName) statusDesc = 'Stopped at ' + info.currentStopName;
        else if (info.vehicleStatus === 0 && info.currentStopName) statusDesc = 'Arriving at ' + info.currentStopName;
        else if (!info.stops || !info.stops.length) statusDesc = 'Live position';
        const speedHtml = speed != null ? ('<div class="info-item"><span class="info-label">Speed</span><span class="info-value">' + speed + ' mph</span></div>') : '';
        return '<div class="train-popup"><div class="train-popup-header"><div>' + badge +
          '<span style="font-size:14.5px;font-weight:700;color:#fff;font-style:italic;"> ' + route + '</span> ' +
          '<span style="font-weight:700;color:#fff;font-style:italic;">' + num + '</span> ' +
          '<span style="color:#fff;font-style:italic;">to</span> ' +
          '<span style="font-weight:700;color:#fff;font-style:italic;">' + dest + '</span>' + alertIcon +
          '</div></div><div class="train-popup-body"><div class="quick-status" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #eee;">' +
          '<p class="status-desc" style="margin:0;">' + statusDesc + '</p><span class="status-pill ' + statusPillClass + '">' + status + '</span></div>' +
          '<div class="info-grid"><div class="info-item"><span class="info-label">Train</span><span class="info-value">' + num + '</span></div>' +
          '<div class="info-item"><span class="info-label">Route</span><span class="info-value">' + route + '</span></div>' +
          '<div class="info-item"><span class="info-label">Status</span><span class="info-value">' + status + '</span></div>' + speedHtml + '</div>' +
          al + '<div class="meta-row">' + origin + ' \u2192 ' + dest + ' \u00b7 Last seen: <strong style="color:#07093e">' + lastSeenTime + '</strong></div>' +
          '<div class="stops-wrapper">' + stopsHtml + '</div></div><div class="train-popup-footer">' + shareBtn + refreshBtn + '</div></div>';
      }
      window.refreshMarcTrain = async function() { return fetchMarcTrains(); };
      function updateMarcVisibility() {
        Object.values(marcMarkers).forEach(function(m) {
          if (showMarc) map.addLayer(m); else map.removeLayer(m);
        });
      }
      function marcParseJoined(vehicleEntity, tripUpdate, usedTrainNums) {
        const v = (vehicleEntity && vehicleEntity.vehicle) || null;
        if (!v || !v.position) return null;
        const lat = Number(v.position.latitude);
        const lon = Number(v.position.longitude);
        if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) return null;
        const vehicleId = (v.vehicle && v.vehicle.id != null) ? String(v.vehicle.id) : '';
        const tu = tripUpdate || null;
        const trip = Object.assign({}, (v && v.trip) || {}, (tu && tu.trip) || {});
        const tripId = trip.trip_id != null ? String(trip.trip_id) : '';
        const trainNum = marcDisplayTrainNum(tripId, vehicleId);
        const routeId = (tu && tu.trip && tu.trip.route_id) ? String(tu.trip.route_id) : (trip.route_id != null ? String(trip.route_id) : '');
        const route = marcRouteInfo(routeId);
        const stops = marcBuildStopsFromTripUpdate(tu);
        const destName = stops.length ? stops[stops.length - 1].name : '\u2014';
        const origName = stops.length ? stops[0].name : '\u2014';
        let maxDelay = null;
        stops.forEach(function(s) {
          if (s.delayMinutes == null) return;
          if (maxDelay == null || Math.abs(s.delayMinutes) > Math.abs(maxDelay)) maxDelay = s.delayMinutes;
        });
        let statusText = 'On Time';
        let statusPillClass = 'status-on-time';
        if (maxDelay != null && Math.abs(maxDelay) > 15) {
          statusText = maxDelay > 0 ? (maxDelay + ' min late') : 'On Time';
          statusPillClass = maxDelay > 0 ? 'status-very-delayed' : 'status-on-time';
        } else if (maxDelay != null && Math.abs(maxDelay) > 5) {
          statusText = maxDelay > 0 ? (maxDelay + ' min late') : 'On Time';
          statusPillClass = maxDelay > 0 ? 'status-delayed' : 'status-on-time';
        } else if (maxDelay != null && maxDelay > 0) {
          statusText = maxDelay + ' min late';
        } else if (!tu) {
          statusText = 'Live';
          statusPillClass = 'status-scheduled';
        }
        let currentStopName = null;
        if (v && v.stop_id) {
          const cs = marcStopCoords(v.stop_id);
          if (cs) currentStopName = cs.name;
        }
        let speedMph = null;
        if (v.position.speed != null) {
          const mps = Number(v.position.speed);
          if (isFinite(mps) && mps >= 0) speedMph = mps * 2.23693629;
        }
        let markerKey = 'marc-' + (vehicleId || trainNum);
        if (usedTrainNums && usedTrainNums.has(markerKey)) markerKey = 'marc-' + String((vehicleEntity && vehicleEntity.id) || vehicleId || trainNum);
        if (usedTrainNums) usedTrainNums.add(markerKey);
        return {
          id: markerKey, trainNum: trainNum, vehicleId: vehicleId || null, routeId: routeId,
          routeName: route.name, routeColor: route.color, routeText: route.text,
          lat: lat, lng: lon, coordSource: 'gps', stops: stops, destName: destName, origName: origName,
          statusText: statusText, statusPillClass: statusPillClass, delayMinutes: maxDelay,
          vehicleStatus: (v.current_status != null) ? Number(v.current_status) : null,
          currentStopName: currentStopName, speedMph: speedMph, tripId: tripId || null,
          hasAlert: false, alertHeader: ''
        };
      }
      async function fetchMarcTrains() {
        const stat = FetchStats.start('MARC');
        try {
          const FeedMessage = getMarcFeedMessageType();
          const [posRes, tuRes] = await Promise.all([
            fetch(MARC_POSITIONS_URL),
            fetch(MARC_TRIPUPDATES_URL)
          ]);
          if (!posRes.ok) throw new Error('positions HTTP ' + posRes.status);
          if (!tuRes.ok) throw new Error('tripupdates HTTP ' + tuRes.status);
          const [posBuf, tuBuf] = await Promise.all([
            posRes.arrayBuffer().then(function(b) { return new Uint8Array(b); }),
            tuRes.arrayBuffer().then(function(b) { return new Uint8Array(b); })
          ]);
          const posFeed = FeedMessage.decode(posBuf);
          const tuFeed = FeedMessage.decode(tuBuf);
          const tuByVehicleId = {};
          const tuByTripId = {};
          (tuFeed.entity || []).forEach(function(entity) {
            const tu = entity.trip_update;
            if (!tu) return;
            if (tu.vehicle && tu.vehicle.id != null && tu.vehicle.id !== '') tuByVehicleId[String(tu.vehicle.id)] = tu;
            if (tu.trip && tu.trip.trip_id) tuByTripId[String(tu.trip.trip_id)] = tu;
          });
          const now = Date.now();
          let created = 0, updated = 0, skipped = 0, joined = 0, gpsOnly = 0;
          const seen = new Set();
          const usedTrainNums = new Set();
          (posFeed.entity || []).forEach(function(entity) {
            const v = entity.vehicle;
            if (!v || !v.position) { skipped++; return; }
            const vehicleId = (v.vehicle && v.vehicle.id != null) ? String(v.vehicle.id) : '';
            const tripId = (v.trip && v.trip.trip_id != null) ? String(v.trip.trip_id) : '';
            const tu = (vehicleId && tuByVehicleId[vehicleId]) || (tripId && tuByTripId[tripId]) || null;
            if (tu) joined++; else gpsOnly++;
            const info = marcParseJoined(entity, tu, usedTrainNums);
            if (!info) { skipped++; return; }
            const vid = info.id;
            seen.add(vid);
            marcTrainInfo[vid] = info;
            marcLastSeen[vid] = now;
            const icon = createMarcIcon();
            const labelInfo = (typeof buildCyclingTrainInfo === 'function') ? buildCyclingTrainInfo({
              agency: 'MARC', routeName: info.routeName, trainNum: info.trainNum, dest: info.destName,
              statusText: info.statusText, lat: info.lat, lng: info.lng
            }) : null;
            if (marcMarkers[vid]) {
              marcMarkers[vid].setLatLng([info.lat, info.lng]);
              marcMarkers[vid].setIcon(icon);
              if (marcMarkers[vid].getPopup()) marcMarkers[vid].setPopupContent(createMarcPopupContent(vid, info));
              if (labelInfo && typeof applyCyclingLabel === 'function') applyCyclingLabel(marcMarkers[vid], labelInfo, false);
              updated++;
            } else {
              const m = L.marker([info.lat, info.lng], { icon: icon });
              m.bindPopup(createMarcPopupContent(vid, info), rrPopupOpts());
              if (labelInfo && typeof applyCyclingLabel === 'function') applyCyclingLabel(m, labelInfo, true);
              marcMarkers[vid] = m;
              if (showMarc) m.addTo(map);
              created++;
            }
          });
          Object.keys(marcMarkers).forEach(function(vid) {
            if (!seen.has(vid)) {
              map.removeLayer(marcMarkers[vid]);
              delete marcMarkers[vid];
              delete marcTrainInfo[vid];
              delete marcLastSeen[vid];
            }
          });
          FetchStats.end(stat, { joined: joined, gpsOnly: gpsOnly, created: created, updated: updated, skipped: skipped, active: Object.keys(marcMarkers).length });
          updateMarcVisibility();
          if (typeof updateTrainLabelsVisibility === 'function') updateTrainLabelsVisibility();
        } catch (e) {
          FetchStats.error('MARC', e);
          console.warn('%c[MARC] GTFS-RT fetch failed \u2014 add /api/marc/* to railroadradar-proxy', 'color:#f39c12', e);
        }
      }
