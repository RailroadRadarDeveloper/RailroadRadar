#!/usr/bin/env python3
from pathlib import Path
path = Path("index.html")
text = path.read_text(encoding="utf-8")
old = """      const RR_LOADING_TIPS = [
        'Check the weekly leaderboard to see if you\u2019re reporting the most!',
        'Guys where is the Readville Switcher??',
        'If you see a special, tap it. Then report it.',
        'Worcester Line on time? Screenshot that.',
        'HSP-46s don\u2019t sparkle themselves.',
        'North Station is a suggestion, not a promise.'
      ];"""
new = """      const RR_LOADING_TIPS = [
        'Check the weekly leaderboard to see if you\u2019re reporting the most!',
        'Guys where is the Readville Switcher??',
        'Worcester Line on time? Screenshot that.',
        'Cab car on the wrong end? That\u2019s a report.',
        'Franklin Line in the garden? Get a photo.'
      ];"""
if old not in text:
    raise SystemExit('tips array not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('patched')
