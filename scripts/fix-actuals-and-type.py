from pathlib import Path

OLD_EARLY = '''        if (tripStopsCache[cacheKey] && (Date.now() - tripStopsCache[cacheKey].timestamp) < 300000) return tripStopsCache[cacheKey].stops;'''

NEW_EARLY = '''        if (tripStopsCache[cacheKey] && (Date.now() - tripStopsCache[cacheKey].timestamp) < 300000) {
          const cachedStops = tripStopsCache[cacheKey].stops || [];
          try {
            const svc = serviceDate || rrStopServiceDate();
            const tnum = (typeof extractTrainNumber === 'function' ? extractTrainNumber(tripId) : '') || String(tripId || '');
            const cached = rrStopActualMem[rrStopActualDocId('mbta', tnum, svc)] || null;
            if (cached) rrApplyStopActuals(cachedStops, cached);
          } catch (_) {}
          return cachedStops;
        }'''

OLD_LEFT = '''            const leftTime = stop.isCompleted
              ? (stop.formattedActualTime || stop.formattedPredictedTime || stop.formattedScheduledTime)
              : (stop.formattedScheduledTime || stop.formattedPredictedTime || '');'''

# handle both old and new leftTime
OLD_LEFT2 = '''            const leftTime = (stop.isCompleted && stop.formattedActualTime) ? stop.formattedActualTime : stop.formattedScheduledTime;'''

NEW_STATUS_NEEDLE = '''            } else if (!stop.predictedTime) {
              cls = 'status-scheduled';
              disp = 'Scheduled';'''

NEW_STATUS = '''            } else if (stop.formattedActualTime) {
              cls = 'status-passed';
              disp = stop.formattedActualTime;
            } else if (!stop.predictedTime) {
              cls = 'status-scheduled';
              disp = 'Scheduled';'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_EARLY in t:
        t = t.replace(OLD_EARLY, NEW_EARLY, 1)
        print('early cache', path)
    if 'function rrStopActualDocId' in t:
        t = t.replace(
            "return [String(agency || 'mbta').toLowerCase(), String(serviceDate || rrStopServiceDate()), String(trainNumber || '').replace(/\\s+/g, '')].join('_');",
            "return [String(agency || 'mbta').toLowerCase(), String(serviceDate || rrStopServiceDate()), String(trainNumber || '').replace(/[^A-Za-z0-9_-]/g, '')].slice(0, 140).join('_');",
            1,
        )
    if NEW_STATUS_NEEDLE in t and 'stop.formattedActualTime) {' not in t[t.find(NEW_STATUS_NEEDLE)-80:t.find(NEW_STATUS_NEEDLE)+40]:
        t = t.replace(NEW_STATUS_NEEDLE, NEW_STATUS, 1)
        print('status', path)
    # smaller text in popup-fit
    t = t.replace('font-size: 13px !important;', 'font-size: 12px !important;')
    t = t.replace('font-size: 14px !important;', 'font-size: 12px !important;')
    t = t.replace('.train-popup,\n    .station-popup {', '.train-popup,\n    .station-popup {\n      font-size: 12px !important;')
    if 'id="rr-popup-fit"' in t and 'rr-popup-text-sm' not in t:
        extra = '''  <style id="rr-popup-text-sm">
    .train-popup, .station-popup, .leaflet-popup-content { font-size: 12px !important; }
    .train-popup-header h3, .station-popup h3, .upcoming-stops h4 { font-size: 13px !important; }
    .stop-time, .stop-name, .stop-status, .info-item { font-size: 11px !important; }
    .popup-action-btn { font-size: 11px !important; }
  </style>\n'''
        t = t.replace('</head>', extra + '</head>', 1)
    p.write_text(t, encoding='utf-8')
    print('done', path)

patch('index.html')
patch('mytrips/index.html')
