# Publish: restore train popup stops list (2026-09-28)

## Root cause
Commit `744a2f3` (marker `rr-ui-fix-2026-09-28c`) set on mobile:
```css
.stops-list, .departures-list { max-height: none !important; /* flex fills remaining height */ }
```
Combined with flex parents using `min-height: 0` + `overflow: hidden` and a shorter popup (`min(420px, 62vh)`), `.stops-list` collapsed to ~0 height and was clipped. JS/`_rrStops` stop-actuals cache was fine.

## Fix (marker `rr-ui-fix-2026-09-28d`)
- Base `.stops-list`/`.departures-list`: `min-height: min(180px, 30vh)` (was `0`)
- `.stops-wrapper` / `.upcoming-stops`: same real min-height
- Mobile: remove `max-height: none`; use `min-height: min(180px, 30vh)`, `max-height: min(200px, 36vh)`, `flex: 1 1 auto`, `overflow-y: auto`
- Preserved: `_rrStops`, Loading-stops cache, stop-actuals

## Trees synced
`rr-publish`, `rr-gh-publish`, `railroadradar-pairing` (+ mytrips/)

## Publish
- Patch: `scripts/popup-stops-visible.patch.gz.b64` (+ parts)
- sha256 b64: `2082621db7bc90c172f204bd0724094169beb81068666eb47c441ceccce7b3bc`
- Workflow: `.github/workflows/apply-popup-stops-visible.yml`
