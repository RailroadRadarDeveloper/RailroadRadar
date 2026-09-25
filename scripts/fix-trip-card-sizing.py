from pathlib import Path

CSS = '''    html.rr-mytrips-page .trip-log-row {
      overflow: hidden;
      max-width: 100%;
      box-sizing: border-box;
    }
    html.rr-mytrips-page .trip-log-row-top {
      padding-right: 76px;
    }
    html.rr-mytrips-page .trip-log-row-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 6px;
      width: auto;
      max-width: 76px;
    }
    html.rr-mytrips-page .trip-log-row-actions button {
      width: 32px;
      height: 32px;
      padding: 0;
      flex: 0 0 32px;
    }
    html.rr-mytrips-page .trip-log-row-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    html.rr-mytrips-page .trip-log-row-tools a,
    html.rr-mytrips-page .trip-log-row-tools button {
      border: 1px solid #c5cad3;
      background: #f7f8fb;
      color: #07093e;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 750;
      padding: 4px 8px;
      line-height: 1.2;
      text-decoration: none;
      cursor: pointer;
    }
    html.rr-mytrips-page .trip-log-row-map {
      height: 148px !important;
      max-height: 148px;
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'trip-log-row-tools' not in t or 'max-width: 76px' not in t:
        needle = '    html.rr-mytrips-page .trip-log-row-actions button {
      cursor: pointer;
    }'
        if needle in t:
            t = t.replace(needle, needle + '\n' + CSS, 1)
        else:
            t = t.replace('.trip-log-row {', CSS + '    .trip-log-row {', 1)
    # stop stuffing extra controls into the corner action cluster
    old = '''        const actions = row.querySelector('.trip-log-row-actions');
        if (actions) {
          const copy = document.createElement('button');
          copy.type = 'button';
          copy.className = 'trip-copy-btn';
          copy.textContent = 'Copy link';'''
    if 'trip-log-row-tools' in t and "row.querySelector('.trip-log-row-tools')" not in t[t.find('function tripEnhanceDashboard'):t.find('function tripEnhanceDashboard')+2500]:
        t = t.replace(
            "        if (row.querySelector('.trip-soon-chip') || row.querySelector('.trip-copy-btn')) return;",
            "        if (row.querySelector('.trip-log-row-tools')) return;",
            1,
        )
        t = t.replace(
            "        const actions = row.querySelector('.trip-log-row-actions');",
            "        const actions = row.querySelector('.trip-log-row-actions');\n        let tools = row.querySelector('.trip-log-row-tools');\n        if (!tools) {\n          tools = document.createElement('div');\n          tools.className = 'trip-log-row-tools';\n          const mapEl = row.querySelector('.trip-log-row-map');\n          if (mapEl) row.insertBefore(tools, mapEl);\n          else row.appendChild(tools);\n        }",
            1,
        )
        t = t.replace('          actions.insertBefore(copy, actions.firstChild);', '          tools.appendChild(copy);')
        t = t.replace('          actions.insertBefore(hide, actions.firstChild);', '          tools.appendChild(hide);')
        t = t.replace('            if (actions) actions.insertBefore(track, actions.firstChild);', '            tools.appendChild(track);')
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
