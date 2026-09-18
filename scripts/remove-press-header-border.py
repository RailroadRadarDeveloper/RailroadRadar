from pathlib import Path
p=Path('press/index.html')
t=p.read_text(encoding='utf-8')
t=t.replace('.header{position:fixed;top:0;left:0;right:0;height:60px;background:var(--navy);display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:20;border-bottom:1px solid #1a3a5f}','.header{position:fixed;top:0;left:0;right:0;height:60px;background:var(--navy);display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:20}')
p.write_text(t,encoding='utf-8')
print('header border removed')
