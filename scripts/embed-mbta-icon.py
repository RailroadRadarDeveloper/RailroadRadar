from pathlib import Path
import base64

src = None
for cand in [Path('assets/icons/mbta.png'), Path('/tmp/mbta.png')]:
    if cand.exists() and cand.stat().st_size > 1000:
        src = cand
        break
if src is None:
    raise SystemExit('mbta.png not downloaded')

raw = src.read_bytes()
# Prefer a compact data URI so the heading icon does not depend on a third-party host.
try:
    from PIL import Image
    from io import BytesIO
    im = Image.open(BytesIO(raw)).convert('RGBA').resize((64, 64), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, format='PNG', optimize=True)
    raw64 = buf.getvalue()
except Exception:
    raw64 = raw

DATA = 'data:image/png;base64,' + base64.b64encode(raw64).decode()
HTML = '<img class="mbta-heading-icon" src="' + DATA + '" alt="MBTA">'

p = Path('index.html')
t = p.read_text(encoding='utf-8')

if 'const MBTA_HEAD_ICON_HTML' not in t:
    needle = '      function extractTrainNumber(tripId) {'
    if needle not in t:
        raise SystemExit('extractTrainNumber missing')
    t = t.replace(needle, '      const MBTA_HEAD_ICON_HTML = ' + repr(HTML) + ';\n' + needle, 1)

t = t.replace(
    '<img class="mbta-heading-icon" src="https://i.postimg.cc/qR9qn1bC/Untitled-design-(12).png" alt="MBTA">',
    '${MBTA_HEAD_ICON_HTML}',
)

t = t.replace(
    "markers[vid]._info = [\n                 rname || 'Unknown',",
    "markers[vid]._info = [\n                 MBTA_HEAD_ICON_HTML + ' ' + (rname || 'Unknown',",
    1,
)
t = t.replace(
    "m._info = [\n                 rname || 'Unknown',",
    "m._info = [\n                 MBTA_HEAD_ICON_HTML + ' ' + (rname || 'Unknown',",
    1,
)

if '.train-label .mbta-heading-icon' not in t:
    t = t.replace(
        '    .mbta-heading-icon { height: 22px; width: auto; display: inline-block; vertical-align: middle; flex: none; }',
        '    .mbta-heading-icon, .train-label img.mbta-heading-icon { height: 18px; width: 18px; object-fit: contain; display: inline-block; vertical-align: middle; flex: none; margin-right: 4px; }',
        1,
    )

p.write_text(t, encoding='utf-8')
print('embedded ok', 'MBTA_HEAD_ICON_HTML' in t, 'data uri', DATA[:30])
