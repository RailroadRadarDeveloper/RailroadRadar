from pathlib import Path

OLD = '    html.rr-mytrips-page .trip-log-list { gap: 12px; }'
NEW = '''    html.rr-mytrips-page .trip-log-list { gap: 20px; }
    html.rr-mytrips-page .trip-log-section-rows {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    html.rr-mytrips-page .trip-log-row {
      margin: 0;
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'trip-log-section-rows' in t and 'gap: 20px' in t:
        print('already spaced', path)
    elif OLD in t:
        t = t.replace(OLD, NEW, 1)
        p.write_text(t, encoding='utf-8')
        print('patched list gap', path)
    else:
        extra = '''    html.rr-mytrips-page .trip-log-section-rows,
    html.rr-mytrips-page .trip-log-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }\n'''
        t = t.replace('.trip-log-list {', extra + '    .trip-log-list {', 1)
        p.write_text(t, encoding='utf-8')
        print('patched fallback', path)

patch('index.html')
patch('mytrips/index.html')
