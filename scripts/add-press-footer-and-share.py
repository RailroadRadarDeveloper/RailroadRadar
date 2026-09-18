from pathlib import Path

FOOTER_OLD = [
    '      <a href="https://www.railroadradar.com/policies/terms-of-use" target="_blank">Terms of Use</a>\n      <a href="https://www.railroadradar.com/policies/privacy" target="_blank">Privacy Policy</a>',
    '      <a href="https://www.railroadradar.com/policies/terms-of-use">Terms of Use</a>\n      <a href="https://www.railroadradar.com/policies/privacy">Privacy Policy</a>',
]
FOOTER_NEW = [
    '      <a href="https://www.railroadradar.com/policies/terms-of-use" target="_blank">Terms of Use</a>\n      <a href="https://railroadradar.com/press/index.html">Press</a>\n      <a href="https://www.railroadradar.com/policies/privacy" target="_blank">Privacy Policy</a>',
    '      <a href="https://www.railroadradar.com/policies/terms-of-use">Terms of Use</a>\n      <a href="https://railroadradar.com/press/index.html">Press</a>\n      <a href="https://www.railroadradar.com/policies/privacy">Privacy Policy</a>',
]

def patch_footer(path):
    p = Path(path)
    if not p.exists():
        return False
    text = p.read_text(encoding='utf-8')
    if 'railroadradar.com/press/index.html">Press</a>' in text or '/press/"' in text and '>Press</a>' in text and path != 'index.html':
        if path == 'index.html' and 'press/index.html">Press</a>' in text:
            return False
    changed = False
    for old, new in zip(FOOTER_OLD, FOOTER_NEW):
        if old in text and 'press/index.html">Press</a>' not in text:
            text = text.replace(old, new, 1)
            changed = True
            break
    if changed:
        p.write_text(text, encoding='utf-8')
    return changed

PRESS = Path('press/index.html')
press = PRESS.read_text(encoding='utf-8')

if '.share-btn{' not in press:
    press = press.replace(
        '.share a{color:#fff}',
        '.share-btn{background:transparent;color:#fff;border:1px solid #a8c0e0;padding:5px 10px;font:700 11px inherit;cursor:pointer;text-transform:uppercase;margin-left:8px;vertical-align:middle}'
    )

press = press.replace(
    '<p class="share">URL: <a href="${urlOf(slug)}">${urlOf(slug)}</a></p>',
    '<p class="share"><button type="button" class="share-btn" id="share">Share</button></p>'
)

if 'id="share"' in press and 'getElementById(\'share\')' not in press and 'getElementById("share")' not in press:
    needle = 'bindReader(a.title||\'\',a.body||\'\');'
    insert = '''bindReader(a.title||'',a.body||'');
const sh=document.getElementById('share');
if(sh)sh.onclick=async()=>{const url=urlOf(slug);try{if(navigator.share){await navigator.share({title:a.title||'RailroadRadar',text:a.title||'',url});return;}}catch(e){}try{await navigator.clipboard.writeText(url);sh.textContent='Copied';setTimeout(()=>sh.textContent='Share',1600);}catch(e){window.prompt('Copy link',url);}};
'''
    if needle in press:
        press = press.replace(needle, insert, 1)

PRESS.write_text(press, encoding='utf-8')

changed = []
for f in ['index.html', 'policies/privacy/index.html', 'policies/terms-of-use/index.html']:
    if patch_footer(f):
        changed.append(f)
print('updated', ', '.join(changed + (['press/index.html'] if True else [])))
