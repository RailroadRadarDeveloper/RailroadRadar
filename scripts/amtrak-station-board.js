      let amtrakAllTrains = [];
      function rrNormStopName(s) {
        return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(station|stop|amtrak|mbta|rail|commuter|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
      }
      const RR_AMTRAK_MBTA_ALIASES = {
        bos: ['south station', 'south sta'],
        bby: ['back bay'],
        rte: ['route 128', 'westwood', 'route 128 westwood'],
        pvd: ['providence'],
        wob: ['anderson woburn', 'woburn', 'anderson'],
        bon: ['north station', 'north sta']
      };
      function rrStopsNear(a, b) {
        if (!a || !b) return false;
        const lat1 = Number(a.lat), lng1 = Number(a.lng != null ? a.lng : a.lon);
        const lat2 = Number(b.lat), lng2 = Number(b.lng != null ? b.lng : b.lon);
        if (![lat1, lng1, lat2, lng2].every(isFinite)) return false;
        const dlat = lat1 - lat2, dlng = lng1 - lng2;
        return (dlat * dlat + dlng * dlng) < (0.0024 * 0.0024);
      }
      function rrAmtrakStopMatches(stop, query) {
        if (!stop || !query) return false;
        const code = String(stop.code || stop.id || '').toLowerCase();
        const qCode = String(query.amtrakCode || '').toLowerCase();
        if (code && qCode && code === qCode) return true;
        const n1 = rrNormStopName(stop.name || stop.code);
        const n2 = rrNormStopName(query.name);
        if (n1 && n2 && (n1 === n2 || n1.indexOf(n2) >= 0 || n2.indexOf(n1) >= 0)) return true;
        const aliases = RR_AMTRAK_MBTA_ALIASES[code] || RR_AMTRAK_MBTA_ALIASES[qCode] || [];
        if (n2 && aliases.indexOf(n2) >= 0) return true;
        if (n1 && aliases.indexOf(n1) >= 0) return true;
        return rrStopsNear(stop, query);
      }
      function getAmtrakStationDepartures(query) {
        const now = Date.now();
        const horizon = now + 24 * 60 * 60 * 1000;
        const out = [];
        const seen = {};
        const trains = (amtrakAllTrains && amtrakAllTrains.length) ? amtrakAllTrains : Object.keys(amtrakTrainInfo || {}).map(function(k) { return amtrakTrainInfo[k]; });
        trains.forEach(function(t) {
          if (!t || !t.stations) return;
          const vid = t.id || ('amtrak-' + (t.trainID || t.trainNum || ''));
          t.stations.forEach(function(s) {
            if (!rrAmtrakStopMatches(s, query)) return;
            const st = String(s.status || '').toLowerCase();
            if (st === 'departed') return;
            const when = new Date(s.dep || s.schDep || s.arr || s.schArr);
            if (!when || isNaN(when.getTime()) || when.getTime() < now - 2 * 60 * 1000 || when.getTime() > horizon) return;
            const key = String(t.trainNum || vid) + '|' + (s.code || s.name || '');
            if (seen[key]) return;
            seen[key] = true;
            const dest = t.destName || t.destCode || (t.stations[t.stations.length - 1] && t.stations[t.stations.length - 1].name) || 'Amtrak';
            out.push({
              agency: 'amtrak',
              tripId: vid,
              routeName: t.routeName || t.route || 'Amtrak',
              destination: dest,
              stopName: s.name || s.code || '',
              trackNumber: s.platform ? String(s.platform) : null,
              scheduledDeparture: when,
              predictedDeparture: s.dep ? new Date(s.dep) : null,
              status: (s.dep && st && st !== 'scheduled') ? (s.status || 'Scheduled') : 'Scheduled',
              isLive: !!(s.dep || (t.lat != null && t.lon != null)),
              formattedScheduledTime: when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          });
        });
        return out;
      }
      async function getCombinedStationDepartures(query) {
        let mbta = [];
        if (query && query.mbtaIds && query.mbtaIds.length && typeof getStationDepartures === 'function') {
          try { mbta = await getStationDepartures(query.mbtaIds) || []; } catch (e) { mbta = []; }
        }
        mbta.forEach(function(d) { d.agency = d.agency || 'mbta'; });
        const amtrak = getAmtrakStationDepartures(query || {});
        return mbta.concat(amtrak).sort(function(a, b) {
          return ((a.predictedDeparture || a.scheduledDeparture) - (b.predictedDeparture || b.scheduledDeparture));
        });
      }
      window.stationDepartureClick = function(agency, tripId, rname, dest, svcDate) {
        if (agency === 'amtrak') {
          const m = amtrakMarkers && (amtrakMarkers[tripId] || amtrakMarkers['amtrak-' + tripId]);
          if (m && m.getLatLng) {
            map.flyTo(m.getLatLng(), 14, { animate: true });
            setTimeout(function() { try { m.openPopup(); } catch (e) {} }, 900);
          }
          return;
        }
        if (typeof openTrainSchedule === 'function') openTrainSchedule(tripId, rname, dest, svcDate);
      };
