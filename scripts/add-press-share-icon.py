from pathlib import Path

p = Path('press/index.html')
t = p.read_text(encoding='utf-8')

if "const SHARE_ICON=" not in t:
    t = t.replace(
        "const A11Y_ICON='https://railroadradar.com/assets/icons/accessibility.png';",
        "const A11Y_ICON='https://railroadradar.com/assets/icons/accessibility.png';\nconst SHARE_ICON='https://railroadradar.com/assets/icons/share.png';",
    )

t = t.replace(
    '.share-btn{background:transparent;color:#fff;border:1px solid #a8c0e0;padding:5px 10px;font:700 11px inherit;cursor:pointer;text-transform:uppercase}',
    '.share-btn{width:36px;height:36px;padding:0;border:0;background:transparent;cursor:pointer}.share-btn img{width:36px;height:36px;display:block}'
)

t = t.replace(
    'img.hero,img.thumb{width:100%;display:block;margin:8px 0 28px;object-fit:cover}',
    'img.hero,img.thumb{width:100%;display:block;margin:8px 0 48px;object-fit:cover}'
)

if '.article .body{color:#fff;margin-top:12px}' not in t:
    t = t.replace(
        '.article .body{color:#fff}',
        '.article .body{color:#fff;margin-top:12px}'
    )

t = t.replace(
    '<button type="button" class="share-btn" id="share">Share</button>',
    '<button type="button" class="share-btn" id="share" aria-label="Share this article"><img src="${SHARE_ICON}" alt=""></button>'
)

old_copy = "sh.textContent='Copied';setTimeout(()=>sh.textContent='Share',1600);"
new_copy = "sh.setAttribute('aria-label','Link copied');setTimeout(()=>sh.setAttribute('aria-label','Share this article'),1600);"
t = t.replace(old_copy, new_copy)

p.write_text(t, encoding='utf-8')
print('patched press/index.html')
