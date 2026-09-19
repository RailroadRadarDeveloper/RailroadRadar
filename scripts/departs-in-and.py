from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')
old="departsMsg = 'Departs in ' + (days && parts.length > 1 ? parts[0] + ', ' + parts.slice(1).join(' ') : parts.join(' '));"
new="departsMsg = 'Departs in ' + (parts.length === 1 ? parts[0] : parts.length === 2 ? parts[0] + ' and ' + parts[1] : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]);"
if old not in t:
    raise SystemExit('phrasing line not found')
t=t.replace(old,new,1)
p.write_text(t, encoding='utf-8')
print('and phrasing set')
