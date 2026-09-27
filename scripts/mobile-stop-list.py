from pathlib import Path

CSS = '''  <style id="rr-stop-list-mobile">
    .stops-list,
    .departures-list {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    .stops-list li .checkmark {
      width: 15px !important;
      height: 15px !important;
      margin-left: 6px;
      vertical-align: -2px;
    }
    @media (max-width: 700px) {
      .leaflet-popup-content {
        max-height: min(70vh, 560px) !important;
      }
      .upcoming-stops h4 {
        font-size: 15px;
        margin: 8px 0 8px;
        line-height: 1.3;
      }
      .upcoming-stops h4 small {
        display: block;
        font-weight: 500;
        opacity: 0.75;
        font-size: 12px;
        margin-top: 2px;
      }
      .stops-list,
      .departures-list {
        max-height: min(48vh, 380px);
      }
      .stops-list li {
        display: grid;
        grid-template-columns: 62px minmax(0, 1fr);
        grid-template-areas:
          "time name"
          "time status";
        column-gap: 10px;
        row-gap: 4px;
        align-items: start;
        padding: 10px 10px;
        font-size: 14px;
        line-height: 1.35;
      }
      .stops-list li .stop-time {
        grid-area: time;
        min-width: 0;
        font-size: 13px;
        padding-top: 1px;
      }
      .stops-list li .stop-name {
        grid-area: name;
        font-size: 14px;
        font-weight: 650;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .stops-list li .stop-status {
        grid-area: status;
        justify-self: start;
        font-size: 12px;
        padding: 3px 8px;
        border-radius: 999px;
      }
      .stops-list li .stop-mileage {
        font-size: 11px !important;
        line-height: 1.3 !important;
        display: block;
        margin-top: 2px;
      }
      .stops-list li .track-badge {
        display: inline-block;
        margin-left: 4px;
        font-size: 11px;
      }
      .departures-list li {
        display: grid;
        grid-template-columns: 62px minmax(0, 1fr);
        gap: 4px 10px;
        padding: 10px 8px;
        font-size: 14px;
        align-items: start;
      }
      .departures-list .departure-time {
        font-size: 13px;
      }
    }
  </style>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'id="rr-stop-list-mobile"' in t:
        print('already', path)
        return
    if '</head>' in t:
        t = t.replace('</head>', CSS + '</head>', 1)
    else:
        t = t.replace('<body', CSS + '<body', 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
