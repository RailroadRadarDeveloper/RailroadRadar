#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("index.html")
text = p.read_text(encoding="utf-8")

n = text.count("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABaCAYAAABwm16")
print("old bar data-uri count", n)
if n:
    text2, replaced = re.subn(
        r"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABaCAYAAABwm16[A-Za-z0-9+/=]+",
        "/assets/icons/leaderboard-bars.png?v=5",
        text,
    )
    print("replaced bar uris", replaced)
    text = text2
elif "/assets/icons/leaderboard-bars.png" in text:
    print("bars already asset-backed")
else:
    raise SystemExit("bar chart data URI not found")

old_trophy = (
    '<div class="rr-lb-winner-trophy"><svg viewBox="0 0 64 64" aria-hidden="true" '
    'focusable="false"><path fill="#22c55e" d="M12 10h40c1.2 0 2 .8 2 2v6c0 8.4-6.2 15.4-14.4 16.7-.6 4.2-3.4 7.7-7.6 9.1v6.2h8.2c1.1 0 2 .9 2 2v3.2H21.8V52c0-1.1.9-2 2-2H32v-6.2c-4.2-1.4-7-4.9-7.6-9.1C16.2 33.4 10 26.4 10 18v-6c0-1.2.8-2 2-2zm4.2 4v4.2c0 5.3 3.3 9.9 8.1 12.1 1.2-5.3 5.8-9.2 11.7-9.2s10.5 3.9 11.7 9.2c4.8-2.2 8.1-6.8 8.1-12.1V14H16.2z"/>'
    '<polygon fill="#fff" points="22,18 44,28 22,36"/></svg></div>'
)
new_trophy = '<div class="rr-lb-winner-trophy"><img src="/assets/icons/leaderboard-trophy.png?v=5" alt="" width="44" height="44"></div>'
if old_trophy in text:
    text = text.replace(old_trophy, new_trophy, 1)
    print("replaced trophy svg")
elif "/assets/icons/leaderboard-trophy.png" in text:
    print("trophy already asset-backed")
else:
    raise SystemExit("trophy svg block not found")

p.write_text(text, encoding="utf-8")
print("done")
