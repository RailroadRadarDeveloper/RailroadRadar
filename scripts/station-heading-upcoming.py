from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')
changed=False
for old in [
    'Next 24 hours <small>(click a train for its schedule)</small>',
    'Next Departures <small>(click for full schedule)</small>',
    'Next Departures',
]:
    if old in t:
        t=t.replace(old, 'Upcoming Departures <small>(click a train for its schedule)</small>' if '<small>' in old else 'Upcoming Departures', 1)
        changed=True
        break
if not changed:
    raise SystemExit('heading not found')
p.write_text(t, encoding='utf-8')
print('heading updated')
