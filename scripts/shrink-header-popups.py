from pathlib import Path
import re

NEW_STYLE = '''  <style id="rr-stop-list-mobile">
    .stops-list li .checkmark {
      width: 15px !important;
      height: 15px !important;
      margin-left: 6px;
      vertical-align: -2px;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content {
        max-width: min(360px, calc(100vw - 20px)) !important;
        width: min(360px, calc(100vw - 20px)) !important;
        max-height: min(48vh, 320px) !important;
      }
      .train-popup,
      .station-popup {
        min-width: min(280px, calc(100vw - 20px)) !important;
        max-width: min(360px, calc(100vw - 20px)) !important;
        width: min(360px, calc(100vw - 20px)) !important;
      }
      .stops-list,
      .departures-list {
        max-height: 200px;
        -webkit-overflow-scrolling: touch;
      }
      .stops-list li {
        display: grid;
        grid-template-columns: auto minmax(120px, 1fr);
        grid-template-areas:
          "time name"
          ". status";
        column-gap: 10px;
        row-gap: 2px;
        padding: 7px 8px;
        font-size: 13px;
      }
      .stops-list li .stop-time { grid-area: time; min-width: 52px; font-size: 12px; white-space: nowrap; }
      .stops-list li .stop-name { grid-area: name; font-size: 13px; font-weight: 650; min-width: 0; }
      .stops-list li .stop-status { grid-area: status; justify-self: start; font-size: 11px; }
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('#map {\n      position: fixed;\n      top: 96px;', '#map {\n      position: fixed;\n      top: 60px;', 1)
    t = t.replace('margin-top: 96px;', 'margin-top: 60px;')
    t = t.replace(
        'max-height: min(380px, 62vh);',
        'max-height: min(48vh, 320px);',
    )
    t2, n = re.subn(r'  <style id="rr-stop-list-mobile">[\\s\\S]*?</style>\\n', NEW_STYLE, t, count=1)
    if n:
        t = t2
        print('replaced style', path)
    else:
        t2, n = re.subn(r'<style id="rr-stop-list-mobile">[\\s\\S]*?</style>', NEW_STYLE.strip(), t, count=1)
        if n:
            t = t2
            print('replaced style loose', path)
        else:
            print('style block not regex-replaced', path)
    p.write_text(t, encoding='utf-8')
    print('96 left', t.count('96px'), path)

patch('index.html')
patch('mytrips/index.html')
