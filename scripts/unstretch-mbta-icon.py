from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')
old='    .mbta-heading-icon, .train-label img.mbta-heading-icon { height: 18px; width: 18px; object-fit: contain; display: inline-block; vertical-align: middle; flex: none; margin-right: 4px; }'
new='    .mbta-heading-icon, .train-label img.mbta-heading-icon { height: 26px; width: auto; object-fit: contain; display: inline-block; vertical-align: middle; flex: none; margin-right: 6px; }'
if old in t:
    t=t.replace(old,new,1)
elif '.mbta-heading-icon { height: 22px' in t:
    t=t.replace('.mbta-heading-icon { height: 22px; width: auto; display: inline-block; vertical-align: middle; flex: none; }', new.strip(), 1)
elif 'mbta-heading-icon' in t:
    # last-resort size bump
    t=t.replace('height: 18px; width: 18px;', 'height: 26px; width: auto;', 1)
else:
    raise SystemExit('icon css not found')
p.write_text(t, encoding='utf-8')
print('icon sizing updated')
