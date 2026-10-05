from pathlib import Path
p = Path('live/user.html')
t = p.read_text(encoding='utf-8')
t = t.replace('href="/live/"', 'href="/"')
t = t.replace('All live trackers', 'RailroadRadar')
p.write_text(t, encoding='utf-8')
print('user header updated')
