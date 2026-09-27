from pathlib import Path
import re

NEW = '''  <style id="rr-stop-list-mobile">
    .stops-list li .checkmark {
      width: 15px !important;
      height: 15px !important;
      margin-left: 6px;
      vertical-align: -2px;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content {
        max-width: min(400px, calc(100vw - 16px)) !important;
        width: min(400px, calc(100vw - 16px)) !important;
        max-height: min(72vh, 580px) !important;
      }
      .train-popup,
      .station-popup {
        min-width: min(300px, calc(100vw - 16px)) !important;
        max-width: min(400px, calc(100vw - 16px)) !important;
        width: min(400px, calc(100vw - 16px)) !important;
      }
      .stops-list,
      .departures-list {
        max-height: min(42vh, 340px);
        -webkit-overflow-scrolling: touch;
      }
      .stops-list li {
        display: grid;
        grid-template-columns: auto minmax(140px, 1fr);
        grid-template-areas:
          "time name"
          ". status";
        column-gap: 12px;
        row-gap: 3px;
        align-items: start;
        padding: 9px 8px;
        font-size: 14px;
      }
      .stops-list li .stop-time {
        grid-area: time;
        min-width: 54px;
        font-size: 13px;
        white-space: nowrap;
      }
      .stops-list li .stop-name {
        grid-area: name;
        font-size: 14px;
        font-weight: 650;
        min-width: 0;
      }
      .stops-list li .stop-status {
        grid-area: status;
        justify-self: start;
        font-size: 12px;
      }
      .departures-list li {
        padding: 9px 8px;
        font-size: 14px;
        gap: 10px;
      }
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t2, n = re.subn(
        r'  <style id="rr-stop-list-mobile">[\s\S]*?</style>\n',
        NEW,
        t,
        count=1,
    )
    if n:
        t = t2
        print('replaced block', path)
    elif 'id="rr-stop-list-mobile"' not in t:
        t = t.replace('</head>', NEW + '</head>', 1)
        print('inserted', path)
    else:
        print('no change', path)
    # undo the earlier min-width:0 squeeze if still present
    t = t.replace(
        '''      .train-popup,
      .station-popup {
        min-width: 0 !important;
        max-width: calc(100vw - 28px) !important;
        width: auto !important;
      }''',
        '''      .train-popup,
      .station-popup {
        min-width: min(300px, calc(100vw - 16px)) !important;
        max-width: min(400px, calc(100vw - 16px)) !important;
        width: min(400px, calc(100vw - 16px)) !important;
      }''',
        1,
    )
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
