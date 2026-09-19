from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

# compute share button before popup html
anchor = "          L.popup(rrPopupOpts()).setLatLng(map.getCenter()).setContent(`"
if anchor not in t:
    raise SystemExit('popup open not found')
# only first occurrence inside openTrainSchedule: search after that function start
fn = t.find('window.openTrainSchedule')
idx = t.find(anchor, fn)
if idx < 0:
    raise SystemExit('popup open inside openTrainSchedule not found')
insert = "          const shareBtn = (typeof rrShareTrainBtnHtml === 'function') ? rrShareTrainBtnHtml('mbta', tid, (typeof extractTrainNumber === 'function' && extractTrainNumber(tid)) || tid) : '';\n"
if 'rrShareTrainBtnHtml(\'mbta\', tid' not in t[fn:fn+4000]:
    t = t[:idx] + insert + t[idx:]

old = '''                <div class="stops-wrapper">${buildStopsHtml(stops)}</div>
              </div>
            </div>
          `).openOn(map);'''
new = '''                <div class="stops-wrapper">${buildStopsHtml(stops)}</div>
              </div>
              <div class="train-popup-footer">${shareBtn}</div>
            </div>
          `).openOn(map);'''
if old not in t:
    raise SystemExit('popup footer insert point not found')
t=t.replace(old,new,1)
p.write_text(t, encoding='utf-8')
print('share button added to scheduled popup')
