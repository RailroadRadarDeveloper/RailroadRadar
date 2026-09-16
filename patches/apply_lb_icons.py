#!/usr/bin/env python3
from pathlib import Path
here = Path(__file__).resolve().parent
root = here.parent
text = (root / "index.html").read_text()
BARS = (here / "lb_bars.uri").read_text().strip()
TROPHY_PATH = here / "lb_trophy.uri"
TROPHY = TROPHY_PATH.read_text().strip() if TROPHY_PATH.exists() else ""

def must_replace(old, new, n=1):
    global text
    if text.count(old) < 1:
        raise SystemExit("missing snippet: " + old[:140].replace("\n", " | "))
    text = text.replace(old, new, n)

must_replace(
    "    .header-leaderboard-icon { display: inline-flex; width: 16px; height: 16px; flex-shrink: 0; }\n    .header-leaderboard-icon svg { width: 16px; height: 16px; display: block; }\n    #weekly-leaderboard-modal .rr-lightbox { width: min(1080px, 96vw); max-height: 94vh; height: 94vh; }\n    .rr-lb-winner { display: flex; align-items: center; gap: 12px; background: #0b1048; color: #fff; border-radius: 12px; padding: 12px 14px; margin: 0 0 16px; }\n    .rr-lb-winner-trophy { width: 42px; height: 42px; flex-shrink: 0; }\n    .rr-lb-winner-trophy svg { width: 42px; height: 42px; display: block; }",
    "    .header-leaderboard-icon { display: inline-flex; width: 18px; height: 18px; flex-shrink: 0; align-items: center; justify-content: center; }\n    .header-leaderboard-icon img { width: 18px; height: 18px; object-fit: contain; display: block; }\n    #weekly-leaderboard-modal .rr-lightbox { width: min(1180px, 98vw); max-height: 96vh; height: 96vh; }\n    .rr-lb-winner { display: flex; align-items: center; gap: 12px; background: #0b1048; color: #fff; border-radius: 12px; padding: 12px 14px; margin: 0 0 16px; }\n    .rr-lb-winner-trophy { width: 44px; height: 44px; flex-shrink: 0; }\n    .rr-lb-winner-trophy img, .rr-lb-winner-trophy svg { width: 44px; height: 44px; object-fit: contain; display: block; }",
)
old_btn = (
    '        <span class="header-leaderboard-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    '<rect x="1.5" y="12.2" width="6" height="10.3" rx="1.4" fill="#22c55e"/>'
    '<rect x="9" y="1.5" width="6" height="21" rx="1.4" fill="#22c55e"/>'
    '<rect x="16.5" y="6.2" width="6" height="16.3" rx="1.4" fill="#22c55e"/></svg></span>'
)
must_replace(old_btn, '        <span class="header-leaderboard-icon"><img src="' + BARS + '" alt="" width="18" height="18"></span>')
must_replace(
    '<button type="button" id="btn-leaderboard-panel" class="cabcar-report-btn" style="margin-top:8px;">Weekly Leaderboard</button>',
    '<button type="button" id="btn-leaderboard-panel" class="cabcar-report-btn" style="margin-top:8px;display:inline-flex;align-items:center;gap:8px;"><img src="' + BARS + '" alt="" width="18" height="18" style="flex-shrink:0;">Weekly Leaderboard</button>',
)
if TROPHY:
    old_trophy = (
        '          <div class="rr-lb-winner-trophy"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
        '<path fill="#22c55e" d="M12 10h40c1.2 0 2 .8 2 2v6c0 8.4-6.2 15.4-14.4 16.7-.6 4.2-3.4 7.7-7.6 9.1v6.2h8.2c1.1 0 2 .9 2 2v3.2H21.8V52c0-1.1.9-2 2-2H32v-6.2c-4.2-1.4-7-4.9-7.6-9.1C16.2 33.4 10 26.4 10 18v-6c0-1.2.8-2 2-2zm4.2 4v4.2c0 5.3 3.3 9.9 8.1 12.1 1.2-5.3 5.8-9.2 11.7-9.2s10.5 3.9 11.7 9.2c4.8-2.2 8.1-6.8 8.1-12.1V14H16.2z"/>'
        '<polygon fill="#fff" points="22,18 44,28 22,36"/></svg></div>'
    )
    must_replace(old_trophy, '          <div class="rr-lb-winner-trophy"><img src="' + TROPHY + '" alt="" width="44" height="44"></div>')
(root / "index.html").write_text(text)
print("applied")
