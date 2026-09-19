from pathlib import Path

B64 = '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'

# The uploaded b64 had one typo risk vs generated; prefer file if present
png = Path('/home/workdir/artifacts/mbta-64.png')
if png.exists():
    import base64
    B64 = base64.b64encode(png.read_bytes()).decode()

DATA = 'data:image/png;base64,' + B64
HTML = '<img class="mbta-heading-icon" src="' + DATA + '" alt="MBTA">'

p = Path('index.html')
t = p.read_text(encoding='utf-8')

if 'const MBTA_HEAD_ICON_HTML' not in t:
    needle = '      function extractTrainNumber(tripId) {'
    if needle not in t:
        raise SystemExit('extractTrainNumber missing')
    t = t.replace(needle, '      const MBTA_HEAD_ICON_HTML = ' + repr(HTML) + ';\n' + needle, 1)

# Point existing postimg tags at the embedded constant
t = t.replace(
    '<img class="mbta-heading-icon" src="https://i.postimg.cc/qR9qn1bC/Untitled-design-(12).png" alt="MBTA">',
    '${MBTA_HEAD_ICON_HTML}',
)

# Map labels for live MBTA trains
old_info = """markers[vid]._info = [
                 rname || 'Unknown',
                 (extractTrainNumber(tripId) || tripId || '\u2014') + ' to ' + (head || '\u2014'),"""
new_info = """markers[vid]._info = [
                 MBTA_HEAD_ICON_HTML + ' ' + (rname || 'Unknown'),
                 MBTA_HEAD_ICON_HTML + ' ' + (extractTrainNumber(tripId) || tripId || '\u2014') + ' to ' + (head || '\u2014'),"""
if old_info in t:
    t = t.replace(old_info, new_info)
else:
    old_info2 = "markers[vid]._info = [\n                 rname || 'Unknown',"
    if old_info2 in t:
        t = t.replace("markers[vid]._info = [\n                 rname || 'Unknown',", "markers[vid]._info = [\n                 MBTA_HEAD_ICON_HTML + ' ' + (rname || 'Unknown'),", 1)

old_info3 = "m._info = [\n                 rname || 'Unknown',"
if old_info3 in t:
    t = t.replace(old_info3, "m._info = [\n                 MBTA_HEAD_ICON_HTML + ' ' + (rname || 'Unknown'),", 1)

if '.train-label .mbta-heading-icon' not in t:
    t = t.replace(
        '    .mbta-heading-icon { height: 22px; width: auto; display: inline-block; vertical-align: middle; flex: none; }',
        '    .mbta-heading-icon, .train-label .mbta-heading-icon { height: 18px; width: 18px; display: inline-block; vertical-align: middle; flex: none; margin-right: 4px; }',
        1,
    )

# Leaflet tooltips accept HTML
t = t.replace(
    "m.bindTooltip('', { permanent: true, direction: 'bottom', offset: [0, 16], className: 'train-label' });",
    "m.bindTooltip('', { permanent: true, direction: 'bottom', offset: [0, 16], className: 'train-label', opacity: 1 });",
    1,
)

p.write_text(t, encoding='utf-8')
print('embedded', t.count('MBTA_HEAD_ICON_HTML'), t.count('data:image/png;base64,'))
