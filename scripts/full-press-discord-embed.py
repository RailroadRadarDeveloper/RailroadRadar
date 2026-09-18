from pathlib import Path

p = Path('press/index.html')
t = p.read_text(encoding='utf-8')

old = """async function notifyDiscord(a){
  try{
    const hook='https://discord.com/api/webhooks/1550613722161086534/0zz4C0rPGbrpDphlGcmFkRpMig27IuZX0cS-n_sw5wnZw8SjRKNoRDUbean4O1DtkJqw';
    const desc=String(a.body||'').replace(/\\s+/g,' ').trim().slice(0,400);
    const embed={title:String(a.title||'Press release').slice(0,256),url:urlOf(a.slug),description:desc+(String(a.body||'').length>400?'\\u2026':''),color:706304,footer:{text:'RailroadRadar Press'},timestamp:new Date().toISOString()};
    const img=a.images&&a.images[0]&&a.images[0].url;
    if(img)embed.image={url:img};
    await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'RailroadRadar',embeds:[embed]})});
  }catch(e){}
}"""

new = """async function notifyDiscord(a){
  try{
    const hook='https://discord.com/api/webhooks/1550613722161086534/0zz4C0rPGbrpDphlGcmFkRpMig27IuZX0cS-n_sw5wnZw8SjRKNoRDUbean4O1DtkJqw';
    const raw=String(a.body||'').trim();
    const title=String(a.title||'Press release').slice(0,256);
    const chunks=[];
    for(let i=0;i<raw.length && chunks.length<10;i+=4096)chunks.push(raw.slice(i,i+4096));
    if(!chunks.length)chunks.push('');
    const img=a.images&&a.images[0]&&a.images[0].url;
    const embeds=chunks.map((desc,i)=>({
      title:i? (title+' (cont.)').slice(0,256):title,
      url:urlOf(a.slug),
      description:desc.slice(0,4096),
      color:706304,
      footer:{text:'RailroadRadar Press'},
      timestamp:new Date().toISOString()
    }));
    if(img)embeds[0].image={url:img};
    await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'RailroadRadar',embeds})});
  }catch(e){}
}"""

if 'raw.slice(i,i+4096)' in t:
    print('already full body')
else:
    if old not in t:
        # looser replace of the 400-char line
        if "slice(0,400)" not in t:
            raise SystemExit('notifyDiscord body slice not found')
        t = t.replace("const desc=String(a.body||'').replace(/\\s+/g,' ').trim().slice(0,400);", "const desc=String(a.body||'').trim().slice(0,4096);")
        t = t.replace("description:desc+(String(a.body||'').length>400?'\\u2026':'')", "description:desc")
        t = t.replace("description:desc+(String(a.body||'').length>400?'\u2026':'')", "description:desc")
    else:
        t = t.replace(old, new, 1)
    if old in Path('press/index.html').read_text(encoding='utf-8') if False else t:
        pass
    if 'slice(i,i+4096)' not in t and old in t:
        t = t.replace(old, new, 1)
    if 'slice(i,i+4096)' not in t:
        start = t.find('async function notifyDiscord')
        end = t.find('function when(ts)', start)
        if start < 0 or end < 0:
            raise SystemExit('cannot replace notifyDiscord')
        t = t[:start] + new + '\n\n' + t[end:]

row_old = '${isAdmin(user)?`<p><button class="btn sec" id="ed">Edit</button> <button class="btn danger" id="del">Delete</button></p>`:''}'
row_new = '${isAdmin(user)?`<p><button class="btn sec" id="ed">Edit</button> <button class="btn sec" id="dc">Send to Discord</button> <button class="btn danger" id="del">Delete</button></p>`:''}'
if row_old in t:
    t = t.replace(row_old, row_new, 1)

handler = "const dc=document.getElementById('dc');if(dc)dc.onclick=async()=>{dc.disabled=true;dc.textContent='Sending\u2026';try{await notifyDiscord({title:a.title||slug,body:a.body||'',slug,images:a.images||[]});dc.textContent='Sent';setTimeout(()=>{dc.textContent='Send to Discord';dc.disabled=false;},1600);}catch(e){dc.textContent='Failed';dc.disabled=false;}};\n"
if "getElementById('dc')" not in t:
    needle = "const ed=document.getElementById('ed');"
    if needle not in t:
        raise SystemExit('edit handler missing')
    t = t.replace(needle, handler + needle, 1)

p.write_text(t, encoding='utf-8')
print('full embed ready')
