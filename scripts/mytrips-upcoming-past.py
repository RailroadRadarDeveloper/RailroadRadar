from pathlib import Path

HELPERS = '''    function tripStartMs(data) {
      if (!data) return 0;
      const segs = Array.isArray(data.segments) ? data.segments : null;
      const raw = (segs && segs[0] && (segs[0].departTime || segs[0].startTime)) || data.startTime;
      const d = raw ? new Date(raw) : null;
      return (d && !isNaN(d.getTime())) ? d.getTime() : 0;
    }
    function tripIsUpcoming(data) {
      return tripStartMs(data) >= Date.now();
    }
    function ensureTripLogSections(list) {
      if (!list) return {};
      let upcoming = document.getElementById('trip-log-upcoming');
      let past = document.getElementById('trip-log-past');
      if (!upcoming) {
        upcoming = document.createElement('section');
        upcoming.id = 'trip-log-upcoming';
        upcoming.className = 'trip-log-section';
        upcoming.innerHTML = '<h3 class="trip-log-section-title">Upcoming trips</h3><div class="trip-log-section-rows" id="trip-log-upcoming-rows"></div>';
        list.appendChild(upcoming);
      }
      if (!past) {
        past = document.createElement('section');
        past.id = 'trip-log-past';
        past.className = 'trip-log-section';
        past.innerHTML = '<h3 class="trip-log-section-title">Past trips</h3><div class="trip-log-section-rows" id="trip-log-past-rows"></div>';
        list.appendChild(past);
      }
      return {
        upcoming: upcoming,
        past: past,
        upcomingRows: document.getElementById('trip-log-upcoming-rows'),
        pastRows: document.getElementById('trip-log-past-rows')
      };
    }

'''

CSS = '''    .trip-log-section { margin: 0 0 24px; }
    .trip-log-section-title {
      margin: 4px 0 12px;
      color: #07093e;
      font-size: 16px;
      font-weight: 800;
    }
    html.rr-mytrips-page .trip-log-section-title { font-size: 18px; }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function tripIsUpcoming' not in t:
        needle = '    function renderTripLogRows(docs, append) {'
        if needle not in t:
            raise SystemExit('renderTripLogRows missing in ' + path)
        t = t.replace(needle, HELPERS + needle, 1)
    if '.trip-log-section {' not in t:
        if '.trip-log-title {\n      color: #07093e;\n    }' in t:
            t = t.replace('.trip-log-title {\n      color: #07093e;\n    }', CSS + '    .trip-log-title {\n      color: #07093e;\n    }', 1)
        else:
            t = t.replace('.trip-log-list {', CSS + '    .trip-log-list {', 1)

    old_reset = '''      if (!append) {
        try { destroyAllTripLogMiniMaps(); } catch (_) {}
        try { Object.keys(tripLogDataById).forEach(function(k) { delete tripLogDataById[k]; }); } catch (_) {}
        list.innerHTML = '';
      }'''
    new_reset = '''      if (!append) {
        try { destroyAllTripLogMiniMaps(); } catch (_) {}
        try { Object.keys(tripLogDataById).forEach(function(k) { delete tripLogDataById[k]; }); } catch (_) {}
        list.innerHTML = '';
      }
      const sections = ensureTripLogSections(list);
      const upcomingRows = sections.upcomingRows || list;
      const pastRows = sections.pastRows || list;'''
    if old_reset in t and 'ensureTripLogSections(list)' not in t[t.find('function renderTripLogRows'):t.find('function renderTripLogRows')+700]:
        t = t.replace(old_reset, new_reset, 1)

    old_append = '''        list.appendChild(row);
        try {
          const mapEl = row.querySelector('.trip-log-row-map');'''
    new_append = '''        if (tripIsUpcoming(data)) upcomingRows.appendChild(row);
        else pastRows.appendChild(row);
        try {
          const mapEl = row.querySelector('.trip-log-row-map');'''
    if old_append in t:
        t = t.replace(old_append, new_append, 1)

    old_end = '''          console.warn('[trip-map] schedule failed', mapErr);
        }
      });
    }

    async function loadTripLogList(reset) {'''
    new_end = '''          console.warn('[trip-map] schedule failed', mapErr);
        }
      });
      if (sections && sections.upcoming) sections.upcoming.hidden = !(upcomingRows && upcomingRows.querySelector('.trip-log-row'));
      if (sections && sections.past) sections.past.hidden = !(pastRows && pastRows.querySelector('.trip-log-row'));
    }

    async function loadTripLogList(reset) {'''
    if old_end in t and 'sections.upcoming.hidden' not in t:
        t = t.replace(old_end, new_end, 1)

    p.write_text(t, encoding='utf-8')
    print('patched', path, 'upcoming' in t and 'Past trips' in t)

patch('index.html')
patch('mytrips/index.html')
