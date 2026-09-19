from pathlib import Path

p = Path('index.html')
t = p.read_text(encoding='utf-8')

t = t.replace('${rname || route ||', '${route ||', 1)

IMG = '<img class="mbta-heading-icon" src="https://i.postimg.cc/qR9qn1bC/Untitled-design-(12).png" alt="MBTA">'

if '.mbta-heading-icon {' not in t:
    t = t.replace(
        '    .train-popup-header {',
        '    .mbta-heading-icon { height: 22px; width: auto; display: inline-block; vertical-align: middle; flex: none; }\n    .train-popup-header {',
        1,
    )

old_live = (
    '                ${mbtaSpecialBadge}\n'
    '                ${capeBadge}\n'
    '                <span style="font-size:14.5px; font-weight:700; color:#ffffff; font-style:italic;">${rname}</span>'
)
new_live = (
    '                ${mbtaSpecialBadge}\n'
    '                ${capeBadge}\n'
    '                ' + IMG + '\n'
    '                <span style="font-size:14.5px; font-weight:700; color:#ffffff; font-style:italic;">${rname}</span>'
)
if old_live not in t:
    raise SystemExit('live MBTA header not found')
if 'mbta-heading-icon' not in t.split('function createTrainPopupContent', 1)[-1][:2500]:
    t = t.replace(old_live, new_live, 1)

old_fut = '                <span style="font-weight:700; color:#ffffff; font-style:italic;">${rname || \'Trip\'}</span>'
new_fut = '                ' + IMG + '\n                <span style="font-weight:700; color:#ffffff; font-style:italic;">${rname || \'Trip\'}</span>'
if old_fut in t and IMG not in t[t.find('window.openTrainSchedule'):t.find('window.openTrainSchedule')+1800]:
    t = t.replace(old_fut, new_fut, 1)

p.write_text(t, encoding='utf-8')
print('ok icons', t.count('mbta-heading-icon'), 'amtrak fixed', '${rname || route' not in t)
