# Publish: train popup body scroll so stops visible (2026-09-28e)

## Root cause
Marker `28d` gave `.stops-list` a real min-height, but `.train-popup-body` still had
`overflow: hidden`. On mobile (~62vh) header+info+alert+loco-report ate the body
height, so the stops block (even at 180px) was clipped below the fold with no way
to scroll. Matches "Stops" heading peeking at the bottom.

## Fix (marker `rr-ui-fix-2026-09-28e`)
- `.train-popup-body { overflow-y: auto }` (was overflow:hidden)
- Upper blocks `flex-shrink: 0`
- `.stops-wrapper` / `.stops-list`: fixed `min-height: 180px`, `flex-shrink: 0`
- Mobile: cap `.loco-report-block` / `.alert-banner` to 72px; stops min-height 160px

## Trees synced
`rr-publish`, `rr-gh-publish`, `railroadradar-pairing` (+ mytrips/)

## Publish
- Patch: `scripts/popup-stops-body-scroll.patch.gz.b64` (+ part1)
- sha256 b64: `fa7fee515de7b23a0950692eb8f61f2e519ece76b713550d04154ba1de4163a6`
- Workflow: `.github/workflows/apply-popup-stops-body-scroll.yml`
