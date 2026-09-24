from pathlib import Path

BAD = '''      if (sections.upcoming) sections.upcoming.hidden = !upcomingRows.querySelector('.trip-log-row');
      if (sections.past) sections.past.hidden = !pastRows.querySelector('.trip-log-row');
      docs.forEach(function(doc) {'''
GOOD = '''      docs.forEach(function(doc) {'''

AFTER = '''          console.warn('[trip-map] schedule failed', mapErr);
        }
      });
    }

    async function loadTripLogList(reset) {'''
AFTER_NEW = '''          console.warn('[trip-map] schedule failed', mapErr);
        }
      });
      if (sections && sections.upcoming) sections.upcoming.hidden = !(upcomingRows && upcomingRows.querySelector('.trip-log-row'));
      if (sections && sections.past) sections.past.hidden = !(pastRows && pastRows.querySelector('.trip-log-row'));
    }

    async function loadTripLogList(reset) {'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if BAD in t:
        t = t.replace(BAD, GOOD, 1)
    if AFTER in t and 'sections.upcoming.hidden = !(upcomingRows' not in t:
        t = t.replace(AFTER, AFTER_NEW, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
