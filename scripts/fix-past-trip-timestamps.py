from pathlib import Path

ASDATE = '''    function tripAsDate(raw) {
      if (raw == null || raw === '') return null;
      try {
        if (typeof raw.toDate === 'function') {
          const d = raw.toDate();
          return (d && !isNaN(d.getTime())) ? d : null;
        }
        if (typeof raw === 'object' && raw.seconds != null) {
          const d = new Date(Number(raw.seconds) * 1000 + Math.floor(Number(raw.nanoseconds || 0) / 1e6));
          return isNaN(d.getTime()) ? null : d;
        }
        if (typeof raw === 'number') {
          const d = new Date(raw);
          return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(String(raw));
        return isNaN(d.getTime()) ? null : d;
      } catch (_) { return null; }
    }
'''

OLD_DEP = '''    function tripDepartInstant(data) {
      if (!data) return null;
      const segs = Array.isArray(data.segments) ? data.segments : null;
      const raw = (segs && segs.length && segs[0].departTime) || data.startTime || data.departTime || null;
      if (raw == null || raw === '') return null;
      try {
        const d = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
        if (isNaN(d.getTime())) return null;'''

NEW_DEP = '''    function tripDepartInstant(data) {
      if (!data) return null;
      const segs = Array.isArray(data.segments) ? data.segments : null;
      const raw = (segs && segs.length && (segs[0].departTime || segs[0].startTime)) || data.startTime || data.departTime || data.startTimeMs || null;
      const d = tripAsDate(raw);
      if (!d) return null;
      try {
        if (isNaN(d.getTime())) return null;'''

OLD_START = '''    function tripStartMs(data) {
      if (!data) return 0;
      const segs = Array.isArray(data.segments) ? data.segments : null;
      const raw = (segs && segs[0] && (segs[0].departTime || segs[0].startTime)) || data.startTime;
      const d = raw ? new Date(raw) : null;'''

NEW_START = '''    function tripStartMs(data) {
      if (!data) return 0;
      const segs = Array.isArray(data.segments) ? data.segments : null;
      const raw = (segs && segs[0] && (segs[0].departTime || segs[0].startTime)) || data.startTime || data.startTimeMs || data.departTime;
      const d = tripAsDate(raw);'''

OLD_WHEN = '''    function formatTripWhen(isoOrMs) {
      try {
        const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(String(isoOrMs || ''));
        if (isNaN(d.getTime())) return '\u2014';'''

NEW_WHEN = '''    function formatTripWhen(isoOrMs) {
      try {
        const d = tripAsDate(isoOrMs);
        if (!d || isNaN(d.getTime())) return '\u2014';'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'function tripAsDate' not in t:
        t = t.replace('    function tripDepartInstant(data) {', ASDATE + '    function tripDepartInstant(data) {', 1)
    if OLD_DEP in t:
        t = t.replace(OLD_DEP, NEW_DEP, 1)
    if OLD_START in t:
        t = t.replace(OLD_START, NEW_START, 1)
    if OLD_WHEN in t:
        t = t.replace(OLD_WHEN, NEW_WHEN, 1)
    # duration helper should use tripAsDate too
    t = t.replace(
        '      const a = new Date(dep).getTime();\n      const b = new Date(arr).getTime();',
        '      const a = (tripAsDate(dep) || new Date(dep)).getTime();\n      const b = (tripAsDate(arr) || new Date(arr)).getTime();',
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'tripAsDate' in t)

patch('index.html')
patch('mytrips/index.html')
