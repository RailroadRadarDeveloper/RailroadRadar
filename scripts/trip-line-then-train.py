from pathlib import Path

OLD_ORDER = '''            '<select data-seg-field="railroad">' + railOpts + '</select>' +
            trainPickHtml +
            '<label>Line</label>' +
            '<select data-seg-field="line">' + lineOpts + '</select>' +'''

NEW_ORDER = '''            '<select data-seg-field="railroad">' + railOpts + '</select>' +
            '<label>Line</label>' +
            '<select data-seg-field="line">' + lineOpts + '</select>' +
            trainPickHtml +'''

OLD_LABEL = '''              '<div><label>Train (schedule)</label>' +
              '<select data-seg-field="trainPick"' + pickDisabled + '>' +
                '<option value="">' + (seg.trainExtraMode ? 'Using Extra / free text' : 'Select a train…') + '</option>' +'''

NEW_LABEL = '''              '<div><label>Train number</label>' +
              '<select data-seg-field="trainPick"' + pickDisabled + '>' +
                '<option value="">' + (seg.trainExtraMode ? 'Using Extra / free text' : (lineId ? 'Select a train…' : 'Select a line first…')) + '</option>' +'''

OLD_FILL = '''      if (!seg || !tripHasSchedulePicker(seg.railroad) || seg.trainExtraMode) {
        return;
      }
      const agency = tripNormalizeAgency(seg.railroad);
      const serviceDate = tripServiceDateFromDepartLocal(seg.departTime);
      const token = (tripScheduleFetchTokens[idx] = (tripScheduleFetchTokens[idx] || 0) + 1);
      const myToken = token;
      sel.disabled = true;
      const prev = sel.value;
      sel.innerHTML = '<option value="">Loading trains…</option>';
      try {
        const rows = await tripFetchScheduleTrains(agency, serviceDate);
        if (myToken !== tripScheduleFetchTokens[idx]) return;
        let html = '<option value="">Select a train…</option>';
        rows.forEach(function(r) {
          const num = String(r.trainNumber).trim();
          const label = tripFormatScheduleTrainLabel(r).replace(/</g, '&lt;').replace(/"/g, '&quot;');
          html += '<option value="' + num.replace(/"/g, '&quot;') + '">' + label + '</option>';
        });
        if (!rows.length) html = '<option value="">No scheduled trains for this date</option>';'''

NEW_FILL = '''      if (!seg || !tripHasSchedulePicker(seg.railroad) || seg.trainExtraMode) {
        return;
      }
      if (!seg.lineId) {
        sel.disabled = false;
        sel.innerHTML = '<option value="">Select a line first…</option>';
        return;
      }
      const agency = tripNormalizeAgency(seg.railroad);
      const serviceDate = tripServiceDateFromDepartLocal(seg.departTime);
      const token = (tripScheduleFetchTokens[idx] = (tripScheduleFetchTokens[idx] || 0) + 1);
      const myToken = token;
      sel.disabled = true;
      const prev = sel.value;
      sel.innerHTML = '<option value="">Loading trains…</option>';
      try {
        const allRows = await tripFetchScheduleTrains(agency, serviceDate);
        if (myToken !== tripScheduleFetchTokens[idx]) return;
        const lineId = String(seg.lineId || '');
        const rows = (allRows || []).filter(function(r) {
          const rid = String(r.lineId || r.routeId || r.route || r.line || '').trim();
          if (rid && rid === lineId) return true;
          const matched = tripMatchLineId(seg.railroad, r.name || r.routeName || r.lineName || '');
          return matched && String(matched) === lineId;
        });
        let html = '<option value="">Select a train…</option>';
        rows.forEach(function(r) {
          const num = String(r.trainNumber).trim();
          const dest = String(r.dest || '').trim();
          const label = dest ? (num + ' · to ' + dest) : num;
          html += '<option value="' + num.replace(/"/g, '&quot;') + '">' + label.replace(/</g, '&lt;').replace(/"/g, '&quot;') + '</option>';
        });
        if (!rows.length) html = '<option value="">No scheduled trains on this line</option>';'''

OLD_LINE = '''      } else if (field === 'line') {
        seg.originId = '';
        seg.destId = '';'''

NEW_LINE = '''      } else if (field === 'line') {
        seg.originId = '';
        seg.destId = '';
        seg.trainNumber = '';'''

OLD_ARRIVE = '''        departTime: defaultTripStartLocalValue(),
        arriveTime: '','''
NEW_ARRIVE = '''        departTime: defaultTripStartLocalValue(),
        arriveTime: defaultTripStartLocalValue(),'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_ORDER in t:
        t = t.replace(OLD_ORDER, NEW_ORDER, 1)
    else:
        print('order block missing', path)
    if OLD_LABEL in t:
        t = t.replace(OLD_LABEL, NEW_LABEL, 1)
    if OLD_FILL in t:
        t = t.replace(OLD_FILL, NEW_FILL, 1)
    else:
        print('fill block missing', path)
    if OLD_LINE in t:
        t = t.replace(OLD_LINE, NEW_LINE, 1)
    if OLD_ARRIVE in t:
        t = t.replace(OLD_ARRIVE, NEW_ARRIVE, 1)
    # after line change, refresh trains (render already happens; extra refresh is in render loop)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
