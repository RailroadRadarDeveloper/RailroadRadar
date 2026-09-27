from pathlib import Path

OLD_LI = '''return `<li class="${stop.isCompleted ? 'completed' : ''}"><span class="stop-time">${leftTime}</span><span class="stop-main"><span class="stop-name">${stop.name} ${track}${done}</span><span class="stop-status ${cls}">${disp}</span>${extraHtml}</span></li>`;'''

NEW_LI = '''return `<li class="${stop.isCompleted ? 'completed' : ''}"><span class="stop-time">${leftTime}</span><span class="stop-name">${stop.name} ${track}${done}${extraHtml}</span><span class="stop-status ${cls}">${disp}</span></li>`;'''

# also if old original still present
ORIG_LI = '''return `<li class="${stop.isCompleted ? 'completed' : ''}"><span class="stop-time">${leftTime}</span><span class="stop-name">${stop.name} ${track}${done}${extraHtml}</span><span class="stop-status ${cls}">${disp}</span></li>`;'''

STYLE = '''  <style id="rr-stop-status-fix">
    .stops-list li {
      display: grid !important;
      grid-template-columns: 68px minmax(0, 1fr) max-content;
      column-gap: 8px;
      align-items: start;
      overflow: visible !important;
    }
    .stops-list li .stop-time {
      white-space: nowrap;
    }
    .stops-list li .stop-name {
      min-width: 0;
      overflow: hidden;
    }
    .stops-list li .stop-status {
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      min-width: max-content !important;
      overflow: visible !important;
      justify-self: end;
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_LI in t:
        t = t.replace(OLD_LI, NEW_LI, 1)
        print('unwrapped li', path)
    elif ORIG_LI in t:
        print('already original li', path)
    else:
        print('li unknown', path)
    if 'id="rr-stop-status-fix"' in t:
        start = t.find('<style id="rr-stop-status-fix">')
        end = t.find('</style>', start) + len('</style>')
        t = t[:start] + STYLE.strip() + t[end:]
    else:
        t = t.replace('</head>', STYLE + '</head>', 1)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
