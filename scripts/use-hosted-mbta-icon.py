from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

IMG = '<img class="mbta-heading-icon" src="/assets/icons/mbta.png" alt="MBTA">'

# Replace interpolated constant in templates with a real img tag
t = t.replace('${MBTA_HEAD_ICON_HTML}', IMG)

# If any leftover postimg tags exist
t = t.replace(
    '<img class="mbta-heading-icon" src="https://i.postimg.cc/qR9qn1bC/Untitled-design-(12).png" alt="MBTA">',
    IMG,
)

# Make sure CSS cannot collapse the image to 0 width
oldcss_options = [
    '    .mbta-heading-icon, .train-label .mbta-heading-icon { height: 26px; width: auto; display: inline-block; vertical-align: middle; flex: none; margin-right: 4px; }',
    '    .mbta-heading-icon, .train-label img.mbta-heading-icon { height: 18px; width: 18px; object-fit: contain; display: inline-block; vertical-align: middle; flex: none; margin-right: 4px; }',
]
newcss = '    .mbta-heading-icon { height: 28px; width: 28px; object-fit: contain; display: inline-block; vertical-align: middle; flex: 0 0 28px; margin: 0 6px 0 0; }\n    .train-label .mbta-heading-icon { height: 16px; width: 16px; flex-basis: 16px; }'
replaced=False
for old in oldcss_options:
    if old in t:
        t=t.replace(old, newcss, 1)
        replaced=True
        break
if not replaced and '.mbta-heading-icon' in t:
    # overwrite first icon rule body if present
    start=t.find('.mbta-heading-icon')
    brace=t.find('{', start)
    end=t.find('}', brace)
    if start>=0 and end>brace:
        t=t[:start]+'.mbta-heading-icon { height: 28px; width: 28px; object-fit: contain; display: inline-block; vertical-align: middle; flex: 0 0 28px; margin: 0 6px 0 0; }\n    .train-label .mbta-heading-icon { height: 16px; width: 16px; }'+t[end+1:]
        replaced=True
if not replaced:
    raise SystemExit('css not updated')

# Map labels
t=t.replace(
    "markers[vid]._info = [\n                 rname || 'Unknown',",
    "markers[vid]._info = [\n                 '"+IMG+" ' + (rname || 'Unknown'),",
    1,
)
t=t.replace(
    "m._info = [\n                 rname || 'Unknown',",
    "m._info = [\n                 '"+IMG+" ' + (rname || 'Unknown'),",
    1,
)

p.write_text(t, encoding='utf-8')
print('hosted icon wired', t.count('/assets/icons/mbta.png'))
