from pathlib import Path

OLD = '''      if (sections && sections.upcoming) sections.upcoming.hidden = !(upcomingRows && upcomingRows.querySelector('.trip-log-row'));
      if (sections && sections.past) sections.past.hidden = !(pastRows && pastRows.querySelector('.trip-log-row'));'''

NEW = '''      if (upcomingRows) {
        const rows = Array.prototype.slice.call(upcomingRows.querySelectorAll('.trip-log-row'));
        rows.sort(function(a, b) {
          const da = tripLogDataById[a.getAttribute('data-trip-id')] || {};
          const db = tripLogDataById[b.getAttribute('data-trip-id')] || {};
          return tripStartMs(da) - tripStartMs(db);
        });
        rows.forEach(function(row) { upcomingRows.appendChild(row); });
      }
      if (sections && sections.upcoming) sections.upcoming.hidden = !(upcomingRows && upcomingRows.querySelector('.trip-log-row'));
      if (sections && sections.past) sections.past.hidden = !(pastRows && pastRows.querySelector('.trip-log-row'));'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'return tripStartMs(da) - tripStartMs(db)' in t:
        print('already sorted', path)
        return
    if OLD not in t:
        raise SystemExit('section visibility block missing in ' + path)
    t = t.replace(OLD, NEW, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
