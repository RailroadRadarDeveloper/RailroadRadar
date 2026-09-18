from pathlib import Path
p = Path('press/index.html')
t = p.read_text(encoding='utf-8')
old = '${isAdmin(user)?`<p><button class="btn sec" id="ed">Edit</button> <button class="btn danger" id="del">Delete</button></p>`:''}'
new = '${isAdmin(user)?`<p><button class="btn sec" id="ed">Edit</button> <button class="btn sec" id="dc">Send to Discord</button> <button class="btn danger" id="del">Delete</button></p>`:''}'
if old in t:
    t = t.replace(old, new, 1)
elif 'id=\"dc\">' in t or "id=\"dc\">" in t or 'id="dc">' in t:
    print('button already present')
else:
    raise SystemExit('admin button row not found')

handler = '''const dc=document.getElementById('dc');if(dc)dc.onclick=async()=>{dc.disabled=true;dc.textContent='Sending\u2026';try{await notifyDiscord({title:a.title||slug,body:a.body||'',slug,images:a.images||[]});dc.textContent='Sent';setTimeout(()=>{dc.textContent='Send to Discord';dc.disabled=false;},1600);}catch(e){dc.textContent='Failed';dc.disabled=false;}};\n'''

needle = "const ed=document.getElementById('ed');"
if "getElementById('dc')" not in t:
    if needle not in t:
        raise SystemExit('edit handler not found')
    t = t.replace(needle, handler + needle, 1)
p.write_text(t, encoding='utf-8')
print('discord button added')
