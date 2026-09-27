from pathlib import Path

OLD_LI = '''return `<li class="${stop.isCompleted ? 'completed' : ''}"><span class="stop-time">${leftTime}</span><span class="stop-name">${stop.name} ${track}${done}${extraHtml}</span><span class="stop-status ${cls}">${disp}</span></li>`;'''

NEW_LI = '''return `<li class="${stop.isCompleted ? 'completed' : ''}"><span class="stop-time">${leftTime}</span><span class="stop-main"><span class="stop-name">${stop.name} ${track}${done}</span><span class="stop-status ${cls}">${disp}</span>${extraHtml}</span></li>`;'''

STYLE = '''  <style id="rr-stop-status-fix">
    .stops-list li {
      display: grid !important;
      grid-template-columns: 70px minmax(0, 1fr);
      column-gap: 8px;
      align-items: start;
      overflow: visible !important;
    }
    .stops-list li .stop-time {
      grid-column: 1;
      white-space: nowrap;
    }
    .stops-list li .stop-main {
      grid-column: 2;
      min-width: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
    }
    .stops-list li .stop-name {
      flex: 1 1 auto;
      min-width: 0;
    }
    .stops-list li .stop-status {
      flex: 0 0 auto;
      white-space: nowrap !important;
      overflow: visible !important;
      min-width: max-content !important;
    }
    .stops-list li .stop-mileage {
      flex: 1 1 100%;
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace("disp = pred ? ('Now ' + pred) : 'Delayed';", "disp = pred ? pred : 'Delayed';")
    if OLD_LI in t:
        t = t.replace(OLD_LI, NEW_LI, 1)
        print('li', path)
    else:
        print('li missing', path)
    if 'id="rr-stop-status-fix"' in t:
        start = t.find('<style id="rr-stop-status-fix">')
        end = t.find('</style>', start) + len('</style>')
        t = t[:start] + STYLE.strip() + t[end:]
    else:
        t = t.replace('</head>', STYLE + '</head>', 1)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
