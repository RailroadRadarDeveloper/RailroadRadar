#!/usr/bin/env python3
from pathlib import Path
path = Path("index.html")
text = path.read_text(encoding="utf-8")
start = text.find("const RR_LOADING_TIPS = [")
end = text.find("]", start)
if start < 0 or end < 0:
    raise SystemExit("tips array not found")
new = """const RR_LOADING_TIPS = [
        'Check the weekly leaderboard to see if you\u2019re reporting the most!',
        'Guys where is the Readville Switcher??',
        'Worcester Line on time? Screenshot that.',
        'Booking a ticket on the concert train.',
        'Share a live trip with your family and friends using the share button on train pop-ups!'
      ]"""
text = text[:start] + new + text[end+1:]
path.write_text(text, encoding="utf-8")
print("patched")
