from pathlib import Path

NEW_FN = '''    function tripTrainNumMatch(hay, num) {
      const n = String(num || '').trim();
      const h = String(hay || '');
      if (!n || !h) return false;
      if (h === n) return true;
      if (h.length >= n.length && h.slice(-n.length) === n) {
        const prev = h.charAt(h.length - n.length - 1);
        if (!prev || ' -_#/'.indexOf(prev) >= 0) return true;
      }
      return h.indexOf(n) >= 0;
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    start = t.find('    function tripTrainNumMatch(hay, num) {')
    if start < 0:
        print('missing', path)
        return
    end = t.find('    async function tripEnrichMbtaStopTimes', start)
    if end < 0:
        print('end missing', path)
        return
    t = t[:start] + NEW_FN + t[end:]
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
