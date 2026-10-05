from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    old = 'function rrSpecialStartMapListener() {\n      if (rrSpecialShareMapStarted) return;'
    new = 'function rrSpecialStartMapListener() {\n      return;\n      if (rrSpecialShareMapStarted) return;'
    if old in t:
        t = t.replace(old, new, 1)
        print('listener off', path)
    else:
        print('listener missing', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
js = Path('assets/js/live-share-bar.js')
bar = js.read_text(encoding='utf-8')
bar = bar.replace(
    "el.querySelector('#rr-live-bar-text').textContent = live",
    "el.querySelector('#rr-live-bar-text').innerHTML = live ? '' : '';\n    el.querySelector('#rr-live-bar-text').textContent = live",
    1,
)
if '/live/' not in bar:
    bar = bar.replace(
        "'<span id=\"rr-live-bar-text\">Sharing paused</span><span class=\"rr-live-actions\">'",
        "'<span id=\"rr-live-bar-text\">Sharing paused</span><span class=\"rr-live-actions\"><a href=\"/live/\" style=\"color:#fff;font-weight:800;\">Live map</a>'",
        1,
    )
    print('link')
js.write_text(bar, encoding='utf-8')
