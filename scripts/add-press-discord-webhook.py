from pathlib import Path

p = Path('press/index.html')
t = p.read_text(encoding='utf-8')

FN = r'''
async function notifyDiscord(a){
  try{
    const hook='https://discord.com/api/webhooks/1550613722161086534/0zz4C0rPGbrpDphlGcmFkRpMig27IuZX0cS-n_sw5wnZw8SjRKNoRDUbean4O1DtkJqw';
    const desc=String(a.body||'').replace(/\s+/g,' ').trim().slice(0,400);
    const embed={title:String(a.title||'Press release').slice(0,256),url:urlOf(a.slug),description:desc+(String(a.body||'').length>400?'\u2026':''),color:706304,footer:{text:'RailroadRadar Press'},timestamp:new Date().toISOString()};
    const img=a.images&&a.images[0]&&a.images[0].url;
    if(img)embed.image={url:img};
    await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'RailroadRadar',embeds:[embed]})});
  }catch(e){}
}
'''

if 'async function notifyDiscord' not in t:
    needle = "function urlOf(s){return 'https://railroadradar.com/press/index.html?id='+encodeURIComponent(s);}"
    if needle not in t:
        raise SystemExit('urlOf not found')
    t = t.replace(needle, needle + FN, 1)

old = "await db.collection('pressReleases').doc(slug).set(payload,{merge:true});location.href='/press/index.html?id='+encodeURIComponent(slug);"
new = "await db.collection('pressReleases').doc(slug).set(payload,{merge:true});if(!slug0)await notifyDiscord({title,body,slug,images});location.href='/press/index.html?id='+encodeURIComponent(slug);"
if old in t:
    t = t.replace(old, new, 1)
elif 'notifyDiscord({title,body,slug,images})' not in t:
    raise SystemExit('save() insert point not found')

p.write_text(t, encoding='utf-8')
print('discord webhook wired')
