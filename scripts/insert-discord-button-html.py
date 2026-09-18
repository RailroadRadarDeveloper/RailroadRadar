from pathlib import Path
p = Path('press/index.html')
t = p.read_text(encoding='utf-8')
old = '${isAdmin(user)?`<p><button class="btn sec" id="ed">Edit</button> <button class="btn danger" id="del">Delete</button></p>`:''}'
new = '${isAdmin(user)?`<p><button class="btn sec" id="ed">Edit</button> <button class="btn sec" id="dc">Send to Discord</button> <button class="btn danger" id="del">Delete</button></p>`:''}'
if old not in t:
    if 'id="dc">Send to Discord' in t:
        print('already inserted')
    else:
        raise SystemExit('target row missing')
else:
    t = t.replace(old, new, 1)
    p.write_text(t, encoding='utf-8')
    print('inserted')
