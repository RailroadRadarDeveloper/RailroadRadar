#!/usr/bin/env python3
from pathlib import Path
path = Path("index.html")
text = path.read_text(encoding="utf-8")
needle = "#btn-report-train-header, #btn-specials-header, #btn-leaderboard-header { display: none !important; }"
repl = "#btn-report-train-header, #btn-specials-header { display: none !important; }"
if needle not in text:
    raise SystemExit("hide rule not found")
text = text.replace(needle, repl, 1)
marker = "#btn-report-train-panel, #btn-specials-panel, #btn-leaderboard-panel { display: block; }"
extra = marker + """
     #btn-leaderboard-header {
       display: inline-flex !important;
       align-items: center;
       justify-content: center;
       background: transparent !important;
       border: none !important;
       box-shadow: none !important;
       padding: 4px !important;
       margin: 0 4px 0 0 !important;
       min-width: 36px;
       min-height: 36px;
       gap: 0;
     }
     #btn-leaderboard-header:hover { background: rgba(255,255,255,0.12) !important; }
     #btn-leaderboard-header .header-leaderboard-label { display: none !important; }
     #btn-leaderboard-header .header-leaderboard-icon {
       width: 24px;
       height: 24px;
     }
     #btn-leaderboard-header .header-leaderboard-icon img {
       width: 24px !important;
       height: 24px !important;
       display: block !important;
       object-fit: contain;
     }"""
if marker not in text:
    raise SystemExit("panel show rule not found")
text = text.replace(marker, extra, 1)
path.write_text(text, encoding="utf-8")
print("patched")
