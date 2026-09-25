from pathlib import Path

HELPER = '''    function tripDurationLabel(data) {
      if (!data) return '';
      const segs = Array.isArray(data.segments) ? data.segments : [];
      const dep = (segs[0] && (segs[0].departTime || segs[0].startTime)) || data.startTime;
      const arr = (segs.length && (segs[segs.length - 1].arriveTime || segs[segs.length - 1].endTime)) || data.endTime;
      if (!dep || !arr) return '';
      const a = new Date(dep).getTime();
      const b = new Date(arr).getTime();
      if (!isFinite(a) || !isFinite(b) || b <= a) return '';
      const mins = Math.round((b - a) / 60000);
      if (mins < 60) return mins + ' min';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m ? (h + ' hr ' + m + ' min') : (h + ' hr');
    }
    function tripMilesValue(data) {
      if (!data) return 0;
      let n = Number(data.miles);
      if (isFinite(n) && n > 0) return n;
      if (Array.isArray(data.segments)) {
        n = data.segments.reduce(function(sum, s) { return sum + (Number(s.miles) || 0); }, 0);
      }
      return isFinite(n) ? n : 0;
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function tripDurationLabel' not in t:
        t = t.replace('    function formatTripMiles(n) {', HELPER + '    function formatTripMiles(n) {', 1)
    t = t.replace(
        "        row.querySelector('.trip-log-row-miles').textContent = miles;",
        '''        const dur = tripDurationLabel(data);
        const milesVal = formatTripMiles(tripMilesValue(data));
        row.querySelector('.trip-log-row-miles').textContent = [milesVal !== '\u2014' ? milesVal : '', dur].filter(Boolean).join(' \u00b7 ') || milesVal;''',
        1,
    )
    t = t.replace(
        "        const milesTxt = formatTripMiles(data.miles);\n        if (milesTxt && milesTxt !== '\u2014') {",
        "        const durTxt = tripDurationLabel(data);\n        if (durTxt) {\n          const dp = document.createElement('span');\n          dp.className = 'trip-detail-fact';\n          dp.textContent = durTxt;\n          meta.appendChild(dp);\n        }\n        const milesTxt = formatTripMiles(tripMilesValue(data));\n        if (milesTxt) {",
        1,
    )
    # dashboard all-time miles
    t = t.replace(
        "      let weekMiles = 0;\n      const days = {};\n      all.forEach(function(t) {\n        const ms = tripStartMs(t);\n        weekMiles += (ms >= week) ? (Number(t.miles) || 0) : 0;",
        "      let weekMiles = 0;\n      let allMiles = 0;\n      const days = {};\n      all.forEach(function(t) {\n        const ms = tripStartMs(t);\n        const mv = tripMilesValue(t);\n        allMiles += mv;\n        weekMiles += (ms >= week) ? mv : 0;",
        1,
    )
    t = t.replace(
        "        '<span class=\"trip-dash-stat\">' + (Math.round(weekMiles * 10) / 10) + ' mi this week</span>' +",
        "        '<span class=\"trip-dash-stat\">' + (Math.round(allMiles * 10) / 10) + ' mi total</span>' +\n        '<span class=\"trip-dash-stat\">' + (Math.round(weekMiles * 10) / 10) + ' mi this week</span>' +",
        1,
    )
    # show relative chip on past cards too
    t = t.replace(
        "          if (relText) {\n            relEl.hidden = false;\n            relEl.textContent = relText;\n          } else {",
        "          if (relText) {\n            relEl.hidden = false;\n            relEl.textContent = relText;\n          } else if (!tripIsUpcoming(data) && tripDisplayWhen(data)) {\n            relEl.hidden = false;\n            relEl.textContent = 'Completed';\n          } else {",
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
