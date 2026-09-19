from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

# Amtrak popup has no rname variable
t=t.replace(
    '<span class="info-value">${rname || route || \'\u2014\'}</span>',
    '<span class="info-value">${route || \'\u2014\'}</span>',
    1,
)
t=t.replace(
    "${rname || route || '\u2014'}",
    "${route || '\u2014'}",
    1,
)

icon='https://railroadradar.com/assets/icons/mbta.png'
fallback='https://i.postimg.cc/qR9qn1bC/Untitled-design-(12).png'
img='<img class="mbta-heading-icon" src="'+icon+'" alt="MBTA" onerror="this.onerror=null;this.src=\''+fallback+'\'">'

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
if 'mbta-heading-icon' not in t[t.find('${mbtaSpecialBadge}'):t.find('${mbtaSpecialBadge}')+450]:
    if live in t:
        t=t.replace(live, live2, 1)
    else:
        raise SystemExit('live mbta header not found')

fut='''                <span style="font-weight:700; color:#ffffff; font-style:italic;">${rname || 'Trip'}</span>'''
if fut in t:
    t=t.replace(fut, '                '+img+'\n'+fut, 1)

old_share='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14.5px;line-height:1.3;color:#ffffff;font-style:italic;"><span style="font-weight:700;color:#ffffff;font-style:italic;">' +
new_share='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14.5px;line-height:1.3;color:#ffffff;font-style:italic;">'+img+'<span style="font-weight:700;color:#ffffff;font-style:italic;">' +
if old_share in t:
    t=t.replace(old_share, new_share, 1)

p.write_text(t, encoding='utf-8')
print('amtrak fixed, icon count', t.count('mbta-heading-icon'))
