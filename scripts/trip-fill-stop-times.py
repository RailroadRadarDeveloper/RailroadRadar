from pathlib import Path

OLD_NORM_PUSH = '''        out.push({ id: id, name: name || id });'''
NEW_NORM_PUSH = '''        out.push({
          id: id,
          name: name || id,
          arrival: s.arrival || s.arrivalTime || s.arr || s.schArr || s.arrive || null,
          departure: s.departure || s.departureTime || s.dep || s.schDep || s.depart || null
        });'''

HELPERS = '''
    function tripApplyStopTimesToSegment(seg) {
      if (!seg || !Array.isArray(seg.scheduleStops) || !seg.scheduleStops.length) return false;
      function matchStop(id) {
        const want = String(id || '');
        if (!want) return null;
        const wantCore = want.replace(/^place-/, '');
        return seg.scheduleStops.find(function(s) {
          const sid = String(s.id || '');
          return sid === want || sid.replace(/^place-/, '') === wantCore;
        }) || null;
      }
      const o = matchStop(seg.originId);
      const d = matchStop(seg.destId);
      let changed = false;
      if (o) {
        const local = isoToLocalInput(o.departure || o.arrival || '');
        if (local && local !== seg.departTime) { seg.departTime = local; changed = true; }
      }
      if (d) {
        const local = isoToLocalInput(d.arrival || d.departure || '');
        if (local && local !== seg.arriveTime) { seg.arriveTime = local; changed = true; }
      }
      return changed;
    }
    function tripTrainNumMatch(hay, num) {
      const n = String(num || '').trim();
      const h = String(hay || '');
      if (!n || !h) return false;
      if (h === n) return true;
      if (h.slice(-n.length) === n && (h.length === n.length || /[-_#\s]/.test(h.charAt(h.length - n.length - 1)))) return true;
      try { return new RegExp('(^|[^0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9]|$)').test(h); }
      catch (_) { return h.indexOf(n) >= 0; }
    }
    async function tripEnrichMbtaStopTimes(seg) {
      const lineId = String(seg.lineId || '');
      const num = String(seg.trainNumber || '').trim();
      if (!lineId || !num) return false;
      const sd = tripServiceDateFromDepartLocal(seg.departTime) || tripServiceDateToday();
      const url = tripScheduleApiBase() + '/api/mbta/schedules?filter[route]=' + encodeURIComponent(lineId) +
        '&filter[date]=' + encodeURIComponent(sd) + '&include=trip';
      const res = await fetch(url);
      if (!res.ok) return false;
      const json = await res.json();
      const trips = {};
      (json.included || []).forEach(function(inc) {
        if (inc && inc.type === 'trip') trips[inc.id] = inc.attributes || {};
      });
      const byTrip = {};
      (json.data || []).forEach(function(row) {
        const rel = row.relationships || {};
        const tid = rel.trip && rel.trip.data && rel.trip.data.id;
        const sid = rel.stop && rel.stop.data && rel.stop.data.id;
        if (!tid || !sid) return;
        const a = row.attributes || {};
        if (!byTrip[tid]) byTrip[tid] = [];
        byTrip[tid].push({
          id: sid,
          name: sid,
          arrival: a.arrival_time || null,
          departure: a.departure_time || null,
          seq: Number(a.stop_sequence) || 0
        });
      });
      let picked = null;
      Object.keys(byTrip).forEach(function(tid) {
        if (picked) return;
        const attrs = trips[tid] || {};
        if (tripTrainNumMatch(tid, num) || tripTrainNumMatch(attrs.name, num) || tripTrainNumMatch(attrs.headsign, num)) {
          picked = byTrip[tid];
        }
      });
      if (!picked) return false;
      picked.sort(function(a, b) { return a.seq - b.seq; });
      seg.scheduleStops = tripNormalizeStopList(picked, seg.railroad);
      return tripApplyStopTimesToSegment(seg);
    }
    async function tripEnrichAmtrakStopTimes(seg) {
      const num = String(seg.trainNumber || '').trim();
      if (!num || typeof amtrakAllTrains === 'undefined' || !Array.isArray(amtrakAllTrains)) return false;
      const train = amtrakAllTrains.find(function(tr) {
        return tripTrainNumMatch(tr.number || tr.trainNum || tr.trainNumber || '', num);
      });
      if (!train || !Array.isArray(train.stations) || !train.stations.length) return false;
      const stops = train.stations.map(function(s) {
        return {
          id: s.code || s.stationCode || s.id || '',
          name: s.name || s.stationName || s.code || '',
          arrival: s.schArr || s.arr || s.arrival || null,
          departure: s.schDep || s.dep || s.departure || null
        };
      });
      seg.scheduleStops = tripNormalizeStopList(stops, 'amtrak');
      return tripApplyStopTimesToSegment(seg);
    }
    async function tripEnrichSegmentSchedule(seg) {
      if (!seg) return false;
      if (tripApplyStopTimesToSegment(seg)) return true;
      const rr = tripNormalizeAgency(seg.railroad);
      try {
        if (rr === 'mbta') return await tripEnrichMbtaStopTimes(seg);
        if (rr === 'amtrak') return await tripEnrichAmtrakStopTimes(seg);
      } catch (e) {
        console.warn('[trip-log] schedule times enrich failed', e);
      }
      return false;
    }
'''

OLD_PICK = '''        if (row) applyScheduleRowToSegment(seg, row);
        else {
          seg.trainNumber = num;
          seg.trainExtraMode = false;
        }
        renderTripSegmentsForm();
        return;'''

NEW_PICK = '''        if (row) applyScheduleRowToSegment(seg, row);
        else {
          seg.trainNumber = num;
          seg.trainExtraMode = false;
        }
        tripEnrichSegmentSchedule(seg).then(function() {
          renderTripSegmentsForm();
        });
        return;'''

OLD_OD = '''        if (seg.originId && seg.destId && seg.originId === seg.destId) {
          if (field === 'origin') seg.destId = '';
          else seg.originId = '';
        }
        // Origin change with ordered schedule stops → filter dest without losing iOS fields via full rebuild is OK (select change)
      }
      renderTripSegmentsForm();'''

NEW_OD = '''        if (seg.originId && seg.destId && seg.originId === seg.destId) {
          if (field === 'origin') seg.destId = '';
          else seg.originId = '';
        }
        tripApplyStopTimesToSegment(seg);
      }
      renderTripSegmentsForm();'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_NORM_PUSH in t and 's.departure || s.departureTime' not in t:
        t = t.replace(OLD_NORM_PUSH, NEW_NORM_PUSH, 1)
    if 'function tripEnrichSegmentSchedule' not in t:
        needle = '    function tripStationsForSegment(seg) {'
        if needle not in t:
            raise SystemExit('insert point missing in ' + path)
        t = t.replace(needle, HELPERS + needle, 1)
    if OLD_PICK in t:
        t = t.replace(OLD_PICK, NEW_PICK, 1)
    else:
        print('trainPick hook missing', path)
    if OLD_OD in t:
        t = t.replace(OLD_OD, NEW_OD, 1)
    else:
        print('origin/dest hook missing', path)
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'tripEnrichSegmentSchedule' in t)

patch('index.html')
patch('mytrips/index.html')
