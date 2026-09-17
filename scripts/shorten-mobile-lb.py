#!/usr/bin/env python3
from pathlib import Path
path = Path("index.html")
text = path.read_text(encoding="utf-8")
old = "    #weekly-leaderboard-modal .rr-lightbox { width: min(1180px, 98vw); max-height: 96vh; height: 96vh; }"
new = """    #weekly-leaderboard-modal .rr-lightbox { width: min(1180px, 98vw); max-height: 96vh; height: 96vh; }
    @media (max-width: 767px) {
      #weekly-leaderboard-modal .rr-lightbox {
        width: min(100vw - 16px, 560px);
        height: auto;
        max-height: 72vh;
      }
    }"""
if old not in text:
    raise SystemExit("lightbox rule not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("patched")
