from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')
icon='https://railroadradar.com/assets/icons/mbta.png'
img='<img class="mbta-heading-icon" src="'+icon+'" alt="MBTA">'
if '.mbta-heading-icon' not in t:
    css='    .mbta-heading-icon {\n      height: 22px;\n      width: auto;\n      display: block;\n      flex: none;\n    }\n'
    needle='    .train-popup-header {'
    if needle in t:
        t=t.replace(needle, css+needle, 1)
live='''                ${mbtaSpecialBadge}
                ${capeBadge}
                <span style="font-size:14.5px; font-weight:700; color:#ffffff; font-style:italic;">${rname}</span>'''
live2='''                ${mbtaSpecialBadge}
                ${capeBadge}
                '''+img+'''
                <span style="font-size:14.5px; font-weight:700; color:#ffffff; font-style:italic;">${rname}</span>'''
if live in t and 'mbta-heading-icon' not in t[t.find(live):t.find(live)+400]:
    t=t.replace(live, live2, 1)
fut='''                <span style="font-weight:700; color:#ffffff; font-style:italic;">${rname || 'Trip'}</span>'''
fut2='''                '''+img+'''
                <span style="font-weight:700; color:#ffffff; font-style:italic;">${rname || 'Trip'}</span>'''
if fut in t:
    t=t.replace(fut, fut2, 1)
old_share='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14.5px;line-height:1.3;color:#ffffff;font-style:italic;"><span style="font-weight:700;color:#ffffff;font-style:italic;">' +
new_share='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14.5px;line-height:1.3;color:#ffffff;font-style:italic;">'+img+'<span style="font-weight:700;color:#ffffff;font-style:italic;">' +
if old_share in t:
    t=t.replace(old_share, new_share, 1)
p.write_text(t, encoding='utf-8')
print('patched headings')
