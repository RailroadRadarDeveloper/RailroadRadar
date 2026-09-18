from pathlib import Path
p = Path('press/index.html')
t = p.read_text(encoding='utf-8')
old = 'id="ed">Edit</button> <button class="btn danger" id="del">Delete</button>'
new = 'id="ed">Edit</button> <button class="btn sec" id="dc">Send to Discord</button> <button class="btn danger" id="del">Delete</button>'
if new in t:
    print('already fixed')
elif old in t:
    t = t.replace(old, new, 1)
    p.write_text(t, encoding='utf-8')
    print('fixed')
else:
    raise SystemExit('edit/delete pair not found')
