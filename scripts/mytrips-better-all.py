from pathlib import Path

CSS = '''    html.rr-mytrips-page .trip-dash-bar {
      display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
      margin: 0 0 16px; padding: 12px 14px; background: #fff;
      border: 1px solid #e6eaf2; border-radius: 14px;
    }
    html.rr-mytrips-page .trip-dash-stat {
      font-size: 13px; font-weight: 750; color: #07093e;
      background: #eef1f8; border-radius: 999px; padding: 6px 12px;
    }
    html.rr-mytrips-page .trip-dash-filter {
      margin-left: auto; min-width: 160px; height: 36px;
      border: 1px solid #c5cad3; border-radius: 10px; padding: 0 10px; color: #07093e;
    }
    html.rr-mytrips-page .trip-soon-chip {
      display: inline-flex; margin-top: 8px; margin-right: 8px;
      background: #0b7a3b; color: #fff; font-size: 11px; font-weight: 800;
      border-radius: 999px; padding: 4px 10px;
    }
    html.rr-mytrips-page .trip-track-btn,
    html.rr-mytrips-page .trip-copy-btn,
    html.rr-mytrips-page .trip-hide-btn {
      border: 1px solid #c5cad3; background: #f7f8fb; color: #07093e;
      border-radius: 8px; font-size: 11px; font-weight: 750; padding: 4px 8px; cursor: pointer;
    }
    html.rr-mytrips-page .trip-log-upcoming-empty {
      color: #5a6270; font-size: 14px; padding: 8px 2px 16px;
    }
    html.rr-mytrips-page .trip-log-empty-cta {
      display: inline-flex; margin-top: 12px; background: #07093e; color: #fff;
      border: 0; padding: 12px 18px; font-weight: 800; font-size: 15px; cursor: pointer; border-radius: 10px;
    }
'''

JS = r'''
    function tripWeekStartMs() {
      const d = new Date();
      const day = d.getDay();
      const diff = (day + 6) % 7;
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() - diff);
      return d.getTime();
    }
    function tripEnhanceDashboard() {
      const all = Object.keys(tripLogDataById || {}).map(function(id) {
        return Object.assign({ id: id }, tripLogDataById[id] || {});
      });
      const week = tripWeekStartMs();
      let weekMiles = 0;
      const days = {};
      all.forEach(function(t) {
        const ms = tripStartMs(t);
        weekMiles += (ms >= week) ? (Number(t.miles) || 0) : 0;
        if (ms) {
          const key = new Date(ms).toISOString().slice(0,10);
          days[key] = true;
        }
      });
      let streak = 0;
      const cur = new Date(); cur.setHours(0,0,0,0);
      for (let i = 0; i < 30; i++) {
        const key = cur.toISOString().slice(0,10);
        if (days[key]) { streak++; cur.setDate(cur.getDate() - 1); }
        else if (i === 0) { cur.setDate(cur.getDate() - 1); }
        else break;
      }
      let bar = document.getElementById('trip-dash-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'trip-dash-bar';
        bar.className = 'trip-dash-bar';
        const list = document.getElementById('trip-log-list');
        if (list && list.parentNode) list.parentNode.insertBefore(bar, list);
      }
      const rails = {};
      all.forEach(function(t) {
        (typeof tripRailIdsFromData === 'function' ? tripRailIdsFromData(t) : [t.railroad]).forEach(function(r) {
          if (r) rails[String(r).toLowerCase()] = true;
        });
      });
      const opts = ['<option value="">All railroads</option>'].concat(Object.keys(rails).sort().map(function(r) {
        return '<option value="' + r + '">' + r.toUpperCase() + '</option>';
      }));
      bar.innerHTML =
        '<span class="trip-dash-stat">' + (Math.round(weekMiles * 10) / 10) + ' mi this week</span>' +
        '<span class="trip-dash-stat">' + (streak ? (streak + '-day streak') : 'No streak yet') + '</span>' +
        '<span class="trip-dash-stat">' + all.length + ' trips</span>' +
        '<select class="trip-dash-filter" id="trip-dash-filter">' + opts.join('') + '</select>';
      const filter = document.getElementById('trip-dash-filter');
      if (filter && filter.getAttribute('data-wired') !== '1') {
        filter.setAttribute('data-wired', '1');
        filter.addEventListener('change', function() {
          const want = String(filter.value || '').toLowerCase();
          document.querySelectorAll('.trip-log-row').forEach(function(row) {
            const id = row.getAttribute('data-trip-id');
            const data = tripLogDataById[id] || {};
            const ids = (typeof tripRailIdsFromData === 'function' ? tripRailIdsFromData(data) : [data.railroad]).map(function(x) { return String(x || '').toLowerCase(); });
            row.style.display = (!want || ids.indexOf(want) >= 0) ? '' : 'none';
          });
        });
      }
      const upcomingRows = document.getElementById('trip-log-upcoming-rows');
      if (upcomingRows && !upcomingRows.querySelector('.trip-log-row')) {
        let empty = document.getElementById('trip-upcoming-empty');
        if (!empty) {
          empty = document.createElement('p');
          empty.id = 'trip-upcoming-empty';
          empty.className = 'trip-log-upcoming-empty';
          empty.innerHTML = 'Nothing coming up. <button type="button" class="trip-log-empty-cta" id="trip-upcoming-log">Log a trip</button>';
          upcomingRows.appendChild(empty);
          const btn = document.getElementById('trip-upcoming-log');
          if (btn) btn.addEventListener('click', function() {
            if (typeof openTripLogModal === 'function') openTripLogModal(null, { tab: 'log', forceModal: true });
          });
        }
      } else {
        const empty = document.getElementById('trip-upcoming-empty');
        if (empty) empty.remove();
      }
      document.querySelectorAll('.trip-log-row').forEach(function(row) {
        const id = row.getAttribute('data-trip-id');
        const data = tripLogDataById[id] || {};
        if (row.querySelector('.trip-soon-chip') || row.querySelector('.trip-copy-btn')) return;
        const ms = tripStartMs(data);
        const soon = ms && ms >= Date.now() && (ms - Date.now()) <= 2 * 3600 * 1000;
        const live = ms && ms <= Date.now() && ((data.endTime ? Date.parse(data.endTime) : ms + 3 * 3600 * 1000) >= Date.now());
        const actions = row.querySelector('.trip-log-row-actions');
        if (actions) {
          const copy = document.createElement('button');
          copy.type = 'button';
          copy.className = 'trip-copy-btn';
          copy.textContent = 'Copy link';
          copy.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            const url = location.origin + '/user/?u=' + encodeURIComponent((window.currentUserProfile && (currentUserProfile.username || currentUserProfile.uid)) || (currentUser && currentUser.uid) || '') + '#trip-' + id;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url);
            if (typeof showNotification === 'function') showNotification('Link copied');
          });
          actions.insertBefore(copy, actions.firstChild);
          const hide = document.createElement('button');
          hide.type = 'button';
          hide.className = 'trip-hide-btn';
          hide.textContent = data.hiddenPublic ? 'Hidden' : 'Hide';
          hide.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            tripToggleHiddenPublic(id, !data.hiddenPublic);
          });
          actions.insertBefore(hide, actions.firstChild);
        }
        const meta = row.querySelector('.trip-log-row-relative') || row;
        if (soon) {
          const chip = document.createElement('span');
          chip.className = 'trip-soon-chip';
          chip.textContent = 'Leaving soon';
          meta.parentNode && meta.parentNode.insertBefore(chip, meta.nextSibling);
        }
        if (live || soon) {
          const segs = data.segments || [];
          const rr = (segs[0] && segs[0].railroad) || data.railroad || 'mbta';
          const num = (segs[0] && segs[0].trainNumber) || data.trainNumber || '';
          if (num) {
            const track = document.createElement('a');
            track.className = 'trip-track-btn';
            track.textContent = 'Track this train';
            track.href = '/?t=' + encodeURIComponent(String(rr).toLowerCase() + ':' + num);
            track.addEventListener('click', function(e) { e.stopPropagation(); });
            if (actions) actions.insertBefore(track, actions.firstChild);
          }
        }
      });
    }
    async function tripToggleHiddenPublic(id, hidden) {
      try {
        if (!db || !currentUser) return;
        await db.collection('tripLogs').doc(currentUser.uid).collection('trips').doc(id).update({ hiddenPublic: !!hidden });
        if (tripLogDataById[id]) tripLogDataById[id].hiddenPublic = !!hidden;
        if (typeof showNotification === 'function') showNotification(hidden ? 'Hidden from public page' : 'Visible on public page');
        tripEnhanceDashboard();
      } catch (e) {
        console.warn('[trip-log] hide failed', e);
      }
    }
    function tripSaveDraft() {
      try {
        if (typeof syncTripSegmentStateFromDom === 'function') syncTripSegmentStateFromDom();
        const draft = { segments: tripLogSegmentsState || [], at: Date.now() };
        localStorage.setItem('rrTripDraft', JSON.stringify(draft));
      } catch (_) {}
    }
    function tripRestoreDraft() {
      try {
        const raw = localStorage.getItem('rrTripDraft');
        if (!raw) return false;
        const draft = JSON.parse(raw);
        if (!draft || !Array.isArray(draft.segments) || !draft.segments.length) return false;
        if (Date.now() - Number(draft.at || 0) > 7 * 24 * 3600 * 1000) return false;
        tripLogSegmentsState = draft.segments;
        return true;
      } catch (_) { return false; }
    }
'''

def patch_main(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function tripEnhanceDashboard' not in t:
        t = t.replace('    function renderTripLogRows(docs, append) {', JS + '    function renderTripLogRows(docs, append) {', 1)
    if "tripEnhanceDashboard();" not in t:
        t = t.replace(
            "      if (sections && sections.past) sections.past.hidden = !(pastRows && pastRows.querySelector('.trip-log-row'));\n    }",
            "      if (sections && sections.past) sections.past.hidden = !(pastRows && pastRows.querySelector('.trip-log-row'));\n      try { tripEnhanceDashboard(); } catch (e) { console.warn(e); }\n    }",
            1,
        )
    if 'mytrips-cursor' in t and 'trip-dash-bar' not in t[t.find('html.rr-mytrips-page .trip-log-list'):t.find('html.rr-mytrips-page .trip-log-list')+200]:
        t = t.replace('    html.rr-mytrips-page .trip-log-list {', CSS + '    html.rr-mytrips-page .trip-log-list {', 1)
    elif 'trip-dash-bar' not in t:
        t = t.replace('.trip-log-list {', CSS + '    .trip-log-list {', 1)
    t = t.replace(
        ">Log trip</button>';",
        ">Log this ride</button>';",
        1,
    )
    if 'tripSaveDraft();' not in t:
        t = t.replace(
            '      syncTripSegmentStateFromDom();',
            '      syncTripSegmentStateFromDom();\n      try { tripSaveDraft(); } catch (_) {}',
            1,
        )
    if "notes: notes || null" in t and 'hiddenPublic:' not in t[t.find('segmentCount: segments.length')-250:t.find('segmentCount: segments.length')+80]:
        t = t.replace(
            '        notes: notes || null,',
            '        hiddenPublic: false,\n        notes: notes || null,',
            1,
        )
    # restore draft when opening log tab if no pending
    if 'tripRestoreDraft()' not in t:
        t = t.replace(
            '    function applyTripLogPrefill(prefill) {',
            '''    function applyTripLogPrefill(prefill) {
      if (!prefill) {
        try { if (tripRestoreDraft()) { renderTripSegmentsForm(); return; } } catch (_) {}
      }
''',
            1,
        )
    p.write_text(t, encoding='utf-8')
    print('patched', path)

def patch_user(path):
    p = Path(path)
    if not p.exists():
        print('no user page')
        return
    t = p.read_text(encoding='utf-8')
    old = 'const upcoming = trips.filter(function (t) { return tripStartMs(t) >= Date.now(); })'
    new = 'trips = (trips || []).filter(function (t) { return !t.hiddenPublic; });\n      const upcoming = trips.filter(function (t) { return tripStartMs(t) >= Date.now(); })'
    if old in t and 'hiddenPublic' not in t:
        t = t.replace(old, new, 1)
    if 'Copy profile link' not in t:
        t = t.replace(
            "document.title = name + ' \u00b7 MyTrips';",
            "document.title = name + ' \u00b7 MyTrips';\n      window.__rrProfileShare = location.href.split('#')[0];",
            1,
        )
    p.write_text(t, encoding='utf-8')
    print('patched user', path)

patch_main('index.html')
patch_main('mytrips/index.html')
patch_user('user/index.html')
