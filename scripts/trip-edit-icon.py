from pathlib import Path

EDIT_BTN = '''            '<button type="button" class="trip-edit-btn" data-trip-edit="' + doc.id + '" aria-label="Edit trip" title="Edit">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
            '</button>' +
'''

JS = '''    let tripLogEditingId = null;
    function tripIsoToLocal(raw) {
      try {
        if (typeof tripAsDate === 'function') {
          const d = tripAsDate(raw);
          if (d) return isoToLocalInput(d.toISOString());
        }
      } catch (_) {}
      return isoToLocalInput(raw) || '';
    }
    function tripDataToSegments(data) {
      const segs = Array.isArray(data && data.segments) && data.segments.length ? data.segments : [data || {}];
      return segs.map(function(s) {
        return emptyTripSegment({
          railroad: tripNormalizeAgency(s.railroad || data.railroad || 'mbta'),
          lineId: s.lineId || '',
          originId: s.originStationId || s.originId || '',
          destId: s.destStationId || s.destId || '',
          trainNumber: String(s.trainNumber || data.trainNumber || ''),
          vehicleId: String(s.vehicleId || ''),
          departTime: tripIsoToLocal(s.departTime || data.startTime),
          arriveTime: tripIsoToLocal(s.arriveTime || data.endTime),
          scheduleStops: s.scheduleStops || null
        });
      });
    }
    function editTripLog(tripId) {
      const data = tripLogDataById[tripId];
      if (!data) return;
      tripLogEditingId = tripId;
      tripLogSegmentsState = tripDataToSegments(data);
      const notesEl = document.getElementById('trip-log-notes');
      if (notesEl) notesEl.value = data.notes || '';
      const stockEl = document.getElementById('trip-log-rolling-stock');
      if (stockEl) stockEl.value = data.rollingStock || '';
      const saveBtn = document.getElementById('trip-log-save');
      if (saveBtn) saveBtn.textContent = 'Save changes';
      if (typeof renderTripSegmentsForm === 'function') renderTripSegmentsForm();
      if (typeof openTripLogModal === 'function') openTripLogModal(null, { tab: 'log', forceModal: true });
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'data-trip-edit' not in t:
        t = t.replace(
            "'<button type=\"button\" class=\"danger\" data-trip-delete=\"' + doc.id + '\" aria-label=\"Delete trip\" title=\"Delete\">' +",
            EDIT_BTN + "            '<button type=\"button\" class=\"danger\" data-trip-delete=\"' + doc.id + '\" aria-label=\"Delete trip\" title=\"Delete\">' +",
            1,
        )
    if 'function editTripLog' not in t:
        t = t.replace('    function deleteTripLog(tripId) {', JS + '    function deleteTripLog(tripId) {', 1)
    if "closest('[data-trip-edit]')" not in t:
        t = t.replace(
            "          const del = e.target.closest('[data-trip-delete]');",
            "          const editBtn = e.target.closest('[data-trip-edit]');\n          if (editBtn) {\n            e.preventDefault();\n            e.stopPropagation();\n            editTripLog(editBtn.getAttribute('data-trip-edit'));\n            return;\n          }\n          const del = e.target.closest('[data-trip-delete]');",
            1,
        )
    # save updates existing doc
    t = t.replace(
        "        const tripRef = db.collection('tripLogs').doc();",
        "        const editingId = tripLogEditingId;\n        const oldData = editingId ? (tripLogDataById[editingId] || {}) : null;\n        const tripRef = editingId ? db.collection('tripLogs').doc(editingId) : db.collection('tripLogs').doc();",
        1,
    )
    t = t.replace(
        "          const next = applyTripMilesToStats(stats, payload, 1);\n          tx.set(tripRef, Object.assign({\n            userId: uid,\n            createdAt: firebase.firestore.FieldValue.serverTimestamp()\n          }, payload));",
        "          let next = stats;\n          if (oldData) next = applyTripMilesToStats(next, oldData, -1);\n          next = applyTripMilesToStats(next, payload, 1);\n          const write = Object.assign({ userId: uid }, payload);\n          if (editingId) write.updatedAt = firebase.firestore.FieldValue.serverTimestamp();\n          else write.createdAt = firebase.firestore.FieldValue.serverTimestamp();\n          tx.set(tripRef, write, { merge: !!editingId });",
        1,
    )
    t = t.replace(
        "        if (typeof showNotification === 'function') showNotification('Trip saved');",
        "        if (typeof showNotification === 'function') showNotification(editingId ? 'Trip updated' : 'Trip saved');\n        tripLogEditingId = null;\n        const saveLbl = document.getElementById('trip-log-save');\n        if (saveLbl) saveLbl.textContent = 'Save trip';",
        1,
    )
    # CSS for edit icon
    if '.trip-edit-btn' not in t:
        t = t.replace(
            '.trip-log-row-actions .danger',
            '''.trip-edit-btn {
      border: 1px solid #c5cad3; background: #f7f8fb; color: #07093e;
      width: 32px; height: 32px; border-radius: 8px; display: inline-flex;
      align-items: center; justify-content: center; cursor: pointer;
    }
    .trip-log-row-actions .danger''',
            1,
        )
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'editTripLog' in t)

patch('index.html')
patch('mytrips/index.html')
