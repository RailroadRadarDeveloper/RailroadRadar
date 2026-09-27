from pathlib import Path

JS = r'''
    function rrStopServiceDate(raw) {
      try {
        const d = raw ? new Date(raw) : new Date();
        if (isNaN(d.getTime())) return new Date().toISOString().slice(0,10);
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      } catch (_) { return new Date().toISOString().slice(0,10); }
    }
    function rrStopActualDocId(agency, trainNumber, serviceDate) {
      return [String(agency || 'mbta').toLowerCase(), String(serviceDate || rrStopServiceDate()), String(trainNumber || '').replace(/\s+/g, '')].join('_');
    }
    const rrStopActualMem = {};
    async function rrLoadStopActuals(agency, trainNumber, serviceDate) {
      const id = rrStopActualDocId(agency, trainNumber, serviceDate);
      if (rrStopActualMem[id] && (Date.now() - (rrStopActualMem[id]._at || 0)) < 60000) return rrStopActualMem[id];
      if (typeof db === 'undefined' || !db) return null;
      try {
        const snap = await db.collection('trainStopActuals').doc(id).get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        let exp = 0;
        try {
          if (data.expiresAt && typeof data.expiresAt.toMillis === 'function') exp = data.expiresAt.toMillis();
          else if (data.expiresAt) exp = new Date(data.expiresAt).getTime();
        } catch (_) {}
        if (exp && exp < Date.now()) return null;
        rrStopActualMem[id] = Object.assign({ _at: Date.now() }, data);
        return rrStopActualMem[id];
      } catch (e) {
        console.warn('[stopActuals] load failed', e && e.message);
        return null;
      }
    }
    function rrApplyStopActuals(stops, cached) {
      if (!stops || !cached || !Array.isArray(cached.stops)) return stops;
      const byId = {};
      const byName = {};
      cached.stops.forEach(function(s) {
        if (s && s.stopId) byId[String(s.stopId)] = s;
        if (s && s.name) byName[String(s.name).toLowerCase()] = s;
      });
      stops.forEach(function(s) {
        const c = byId[String(s.id || s.stopId || '')] || byName[String(s.name || '').toLowerCase()];
        if (!c) return;
        if (c.actual) {
          s.formattedActualTime = c.actual;
          if (s.isCompleted && !s.formattedPredictedTime) s.formattedPredictedTime = c.actual;
        }
        if (c.completed || c.actual) s.isCompleted = true;
      });
      return stops;
    }
    function rrSaveStopActuals(agency, trainNumber, serviceDate, stops) {
      if (typeof db === 'undefined' || !db || !stops || !stops.length) return;
      const id = rrStopActualDocId(agency, trainNumber, serviceDate);
      const payloadStops = stops.map(function(s) {
        const actual = s.formattedActualTime || (s.isCompleted ? (s.formattedPredictedTime || s.formattedScheduledTime) : null);
        return {
          name: s.name || '',
          stopId: String(s.id || s.stopId || ''),
          scheduled: s.formattedScheduledTime || null,
          predicted: s.formattedPredictedTime || null,
          actual: actual,
          completed: !!s.isCompleted,
          delayMinutes: Number(s.delayMinutes) || 0
        };
      });
      const last = stops[stops.length - 1] || {};
      const lastDate = last.scheduledTime || last.predictedTime || last.actualTime || Date.now();
      const lastMs = (lastDate && lastDate.getTime) ? lastDate.getTime() : Number(lastDate) || Date.now();
      const expires = Math.max(Date.now(), lastMs) + 24 * 60 * 60 * 1000;
      const doc = {
        agency: String(agency || 'mbta').toLowerCase(),
        trainNumber: String(trainNumber || ''),
        serviceDate: String(serviceDate || rrStopServiceDate()),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromMillis(expires),
        stops: payloadStops
      };
      db.collection('trainStopActuals').doc(id).set(doc, { merge: true }).then(function() {
        rrStopActualMem[id] = Object.assign({ _at: Date.now(), stops: payloadStops }, doc);
      }).catch(function(e) {
        console.warn('[stopActuals] save failed', e && e.message);
      });
    }
'''

HOOK = '''          try {
            const svc = serviceDate || (stops[0] && stops[0].scheduledTime ? rrStopServiceDate(stops[0].scheduledTime) : rrStopServiceDate());
            const tnum = (typeof extractTrainNumber === 'function') ? extractTrainNumber(tripId) : String(tripId || '');
            const cached = await rrLoadStopActuals('mbta', tnum, svc);
            if (cached) rrApplyStopActuals(stops, cached);
            rrSaveStopActuals('mbta', tnum, svc, stops);
          } catch (cacheErr) { console.warn('[stopActuals]', cacheErr); }
          tripStopsCache[cacheKey] = { stops, timestamp: Date.now() };'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function rrSaveStopActuals' not in t:
        t = t.replace('    async function getTripStops(tripId, serviceDate) {', JS + '    async function getTripStops(tripId, serviceDate) {', 1)
        print('js inserted', path)
    old = '          tripStopsCache[cacheKey] = { stops, timestamp: Date.now() };'
    if old in t and 'rrSaveStopActuals' not in t[t.find(old)-200:t.find(old)+80]:
        t = t.replace(old, HOOK, 1)
        print('hooked', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
