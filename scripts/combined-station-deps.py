from pathlib import Path

FN = r'''
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
        Object.keys(amtrakTrainInfo || {}).forEach(function(vid) {
          const t = amtrakTrainInfo[vid];
          if (!t || !t.stations) return;
          t.stations.forEach(function(s) {
            if (!rrAmtrakStopMatches(s, query)) return;
            const st = String(s.status || '').toLowerCase();
            if (st === 'departed') return;
            const when = new Date(s.dep || s.schDep || s.arr || s.schArr);
            if (!when || isNaN(when.getTime()) || when.getTime() < now - 2 * 60 * 1000 || when.getTime() > horizon) return;
            const key = vid + '|' + (s.code || s.name || '');
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
              status: st && st !== 'scheduled' && st !== 'enroute' ? s.status : 'Scheduled',
              isLive: true,
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
        const all = mbta.concat(amtrak);
        all.sort(function(a, b) {
          return ((a.predictedDeparture || a.scheduledDeparture) - (b.predictedDeparture || b.scheduledDeparture));
        });
        return all;
      }
      window.stationDepartureClick = function(agency, tripId, rname, dest, svcDate) {
        if (agency === 'amtrak') {
          const m = (amtrakMarkers && (amtrakMarkers[tripId] || amtrakMarkers['amtrak-' + tripId]));
          if (m && m.getLatLng) {
            map.flyTo(m.getLatLng(), 14, { animate: true });
            setTimeout(function() { try { m.openPopup(); } catch (e) {} }, 900);
          }
          return;
        }
        if (typeof openTrainSchedule === 'function') openTrainSchedule(tripId, rname, dest, svcDate);
      };
'''

p = Path('index.html')
t = p.read_text(encoding='utf-8')

if 'function getCombinedStationDepartures' not in t:
    needle = '      function createStationPopupContent(name, ids, deps, n) {'
    if needle not in t:
        raise SystemExit('createStationPopupContent not found')
    t = t.replace(needle, FN + needle, 1)

# Agency badge + click handler in list rows
old_li = '''              return `<li onclick="openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,"\\'")}', '${d.destination.replace(/'/g,"\\'")}', '${svcDate}')" style="cursor:pointer">
                <span class="departure-time">${d.formattedScheduledTime}</span>
                <span class="departure-destination">${d.destination || d.routeName} ${plat} ${trk} ${live}</span>'''
new_li = '''              const ag = d.agency === 'amtrak' ? 'Amtrak' : 'MBTA';
              return `<li onclick="stationDepartureClick('${d.agency || 'mbta'}', '${String(d.tripId||'').replace(/'/g,"\\'")}', '${d.routeName.replace(/'/g,"\\'")}', '${d.destination.replace(/'/g,"\\'")}', '${svcDate}')" style="cursor:pointer">
                <span class="departure-time">${d.formattedScheduledTime}</span>
                <span class="departure-destination"><small>${ag}</small> ${d.destination || d.routeName} ${plat} ${trk} ${live}</span>'''
if old_li in t:
    t = t.replace(old_li, new_li, 1)
else:
    # weaker replace of the onclick only
    t = t.replace(
        'onclick="openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,"\\'")}', '${d.destination.replace(/'/g,"\\'")}', '${svcDate}')"',
        'onclick="stationDepartureClick('${d.agency || \'mbta\'}', '${String(d.tripId||\'\').replace(/'/g,"\\'")}', '${d.routeName.replace(/'/g,"\\'")}', '${d.destination.replace(/'/g,"\\'")}', '${svcDate}')"',
        1,
    )
    t = t.replace(
        '<span class="departure-destination">${d.destination || d.routeName}',
        '<span class="departure-destination"><small>${d.agency === \'amtrak\' ? \'Amtrak\' : \'MBTA\'}</small> ${d.destination || d.routeName}',
        1,
    )

# MBTA station popupopen uses combined list
t = t.replace(
    '''            m.on('popupopen', async () => {
              const deps = await getStationDepartures(g.stopIds);
              m.getPopup().setContent(createStationPopupContent(g.name, g.stopIds, deps, n));
            });''',
    '''            m._rrStation = { name: g.name, mbtaIds: g.stopIds, lat: g.lat, lng: g.lng };
            m.on('popupopen', async () => {
              const deps = await getCombinedStationDepartures(m._rrStation);
              m.getPopup().setContent(createStationPopupContent(g.name, g.stopIds, deps, n));
            });''',
    1,
)

# Amtrak station dots load combined departures
old_up = "        m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');\n        stationMarkers[key] = m;"
new_up = "        m._rrStation = { name: title, amtrakCode: a === 'amtrak' ? String(sid) : '', lat: latN, lng: lngN };\n        m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><div class=\"loading-departures\"><span class=\"loading-spinner\"></span> Loading departures...</div></div>', typeof rrPopupOpts === 'function' ? rrPopupOpts() : undefined);\n        m.on('popupopen', async function() {\n          const deps = await getCombinedStationDepartures(m._rrStation || { name: title, amtrakCode: String(sid), lat: latN, lng: lngN });\n          if (m.getPopup) m.getPopup().setContent(createStationPopupContent(title, [key], deps, 1));\n        });\n        stationMarkers[key] = m;"
if old_up in t:
    t = t.replace(old_up, new_up, 1)
else:
    raise SystemExit('amtrak bindPopup not found')

# Refresh should also combine
t = t.replace(
    '          const deps = await getStationDepartures(ids);\n          m.getPopup().setContent(createStationPopupContent(nm, ids, deps, ids.length));',
    '          const q = m._rrStation || { name: nm, mbtaIds: ids };\n          const deps = await getCombinedStationDepartures(q);\n          m.getPopup().setContent(createStationPopupContent(nm, ids, deps, ids.length));',
    1,
)

p.write_text(t, encoding='utf-8')
print('combined station lists ready')
