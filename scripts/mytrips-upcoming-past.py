from pathlib import Path

HELPER = '''
    function tripStartMs(data) {
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

CSS = '''
    .trip-log-section {
      margin: 0 0 22px;
    }
    .trip-log-section-title {
      margin: 0 0 12px;
      color: #07093e;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    html.rr-mytrips-page .trip-log-section-title {
      font-size: 18px;
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function tripIsUpcoming' not in t:
        needle = '    function renderTripLogRows(docs, append) {'
        if needle not in t:
            raise SystemExit('renderTripLogRows missing in ' + path)
        t = t.replace(needle, HELPER + needle, 1)
    if '.trip-log-section-title' not in t:
        t = t.replace('.trip-log-title {\n      color: #07093e;\n    }', CSS + '    .trip-log-title {\n      color: #07093e;\n    }', 1)

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
    if old_reset in t and 'ensureTripLogSections(list)' not in t[t.find('function renderTripLogRows'):t.find('function renderTripLogRows')+900]:
        t = t.replace(old_reset, new_reset, 1)

    old_for = '''      docs.forEach(function(doc) {
        const data = doc.data() || {};
        const row = document.createElement('div');
        row.className = 'trip-log-row';'''
    new_for = '''      let upcomingCount = upcomingRows ? upcomingRows.querySelectorAll('.trip-log-row').length : 0;
      let pastCount = pastRows ? pastRows.querySelectorAll('.trip-log-row').length : 0;
      docs.forEach(function(doc) {
        const data = doc.data() || {};
        const row = document.createElement('div');
        row.className = 'trip-log-row';'''
    if old_for in t:
        t = t.replace(old_for, new_for, 1)

    # append row to the right section instead of list
    # Find list.appendChild(row) inside renderTripLogRows — may appear later in the function
    fn_start = t.find('function renderTripLogRows')
    fn_end = t.find('\n    function ', fn_start + 10)
    if fn_end < 0: fn_end = fn_start + 8000
    block = t[fn_start:fn_end]
    if 'upcomingRows.appendChild' not in block:
        if 'list.appendChild(row)' in block:
            block2 = block.replace('list.appendChild(row)', '''if (tripIsUpcoming(data)) { upcomingRows.appendChild(row); upcomingCount++; } else { pastRows.appendChild(row); pastCount++; }''', 1)
            t = t[:fn_start] + block2 + t[fn_end:]
        else:
            print('appendChild(row) not found in', path)

    # toggle section visibility + empty state after loop — hook setTripLogEmptyVisible(false) after forEach is hard; add after function's empty handling
    vis = '''      if (sections.upcoming) sections.upcoming.hidden = !upcomingRows.querySelector('.trip-log-row');
      if (sections.past) sections.past.hidden = !pastRows.querySelector('.trip-log-row');'''
    # insert before end of renderTripLogRows by finding a late unique line
    marker = 'setTripLogEmptyVisible(false);'
    # first occurrence in function is when docs empty; second after starting to add
    # add visibility update after rows are added: look for bind trip row clicks nearby
    if 'sections.upcoming.hidden' not in t[fn_start:fn_start+9000]:
        click = 'row.addEventListener(\'click\''
        # simpler: after forEach closes - search "});\n      }" following docs.forEach
        t = t.replace(
            '      docs.forEach(function(doc) {',
            vis.replace('upcomingCount', 'upcomingCount') + '\n      docs.forEach(function(doc) {',
            1,
        )
        # that would run BEFORE rows added. Move to after forEach instead.
        # undo that if we just inserted too early — do a dedicated after-loop insert
        pass

    p.write_text(t, encoding='utf-8')
    print('partial patch written', path)

patch('index.html')
patch('mytrips/index.html')
