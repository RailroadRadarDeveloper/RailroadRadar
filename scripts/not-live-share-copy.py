from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')
msg='That train is not live right now. Open the full map to browse other trains.'
replacements=[
    ("if (status) status.textContent = 'Looking for that train\u2026';", "if (status) status.textContent = 'That train is not live right now';"),
    ("if (status) status.textContent = 'Looking for that train...';", "if (status) status.textContent = 'That train is not live right now';"),
    ('Looking for that train\u2026 If it is not running right now, open the full map to browse live trains.', msg),
    ('Looking for that train... If it is not running right now, open the full map to browse live trains.', msg),
]
# also normalize existing close variant if needed
changed=0
# handle actual file ellipsis char
for old,new in [
    "Looking for that train…",
    "Looking for that train...",
]:
    if old in t:
        # don't blindly replace the short status-only if we want specific sentences
        pass

t=t.replace(
    "if (status) status.textContent = 'Looking for that train…';",
    "if (status) status.textContent = 'That train is not live right now';",
)
t=t.replace(
    'Looking for that train… If it is not running right now, open the full map to browse live trains.',
    msg,
)
# keep the later empty-state sentence consistent (already almost this)
t=t.replace(
    'That train is not live right now. Open the full map to browse other trains.',
    msg,
)
p.write_text(t, encoding='utf-8')
print('copy updated', 'Looking for that train' in p.read_text(encoding='utf-8'))
