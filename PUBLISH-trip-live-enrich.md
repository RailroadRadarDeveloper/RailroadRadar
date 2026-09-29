# Publish: MyTrips live progress + post-trip enrich (2026-09-29)

## Ask
1. Live progress on logged trips (card + detail): next stop, delay, live minimap marker.
2. Post-trip enrichment: fill actual dep/arr from live/stop-actuals after a ride ends.

## What already existed (Sep 24)
`/* Trip live in-progress light */` — detail-only slow poll (50s), match by railroad+train # via `rrFindSharedTrain` / `rrCollectLiveTrainRows`, `#trip-detail-live` status + detail-map blue marker, **zero Firestore writes** on poll.

## What this ships
### (1) Live progress
- Extends the Sep 24 tracker; warm short copy via `tripLiveWarmCopy` (e.g. `Next: Providence · 8 min late`).
- Card chip `.trip-log-row-live` + slow list poll `TRIP_LIVE_LIST_POLL_MS` (55s); pauses when tab hidden.
- Live blue marker on card minimaps (`tripLivePaintCardMarker`) and detail map.
- Still **no Firestore writes** for live display.

### (2) Post-trip enrichment
- After trip leaves the live window (or on open / list of recent completed): `tripTryEnrichActualTimes`.
- Sources: Amtrak live station dep/arr ISO when present; else `trainStopActuals` (same as main-map popups) via `rrLoadStopActuals`.
- Persists **only** `actualDepartTime` / `actualArriveTime` (+ per-segment) and `actualTimesEnrichedAt` — **does not** overwrite user `departTime` / `arriveTime` / `startTime` / `endTime`.
- UI: `.trip-log-row-actual` + `#trip-detail-actual` (“Actual … → …”).

## Markers (grep)
- `/* Trip live progress cards + post-trip enrich */`
- `tripLiveWarmCopy` / `startTripListLivePoll` / `tripTryEnrichActualTimes`
- `TRIP_LIVE_LIST_POLL_MS` / `actualDepartTime`

## Preserved
`rrAuthUser`, nearby prompt, stop-actuals / `_rrStops`, full-color railroad cards, wider layout, Alt Light minimap tiles (`rrTripMapTileUrl`).
Also preserved after urgent fix stack: `tripLogEditingId`, `editTripLog`, `tripMbtaCanonicalStationId`.

## Note on rules
Client can already call `rrLoadStopActuals` (public read in local `firestore.rules`). If live enrichment silently no-ops, deploy `trainStopActuals` rules from `TRAIN-STOP-ACTUALS-RULES.md` (separate pending todo).

## Artifact
- `scripts/trip-live-enrich.patch.gz.b64` (+ `.part1` `.part2`)
- sha256 `3a5034ca0ab63c169ff12567526fb6308cd5d62e5138311de1867b0f0ee1975b`
- Workflow: `.github/workflows/apply-trip-live-enrich.yml`

## Publish
- Chore (placeholders then real parts): `9b6730033d8600e606fffe6b1e9f0a90b6e9c8f9` → `a4248abc466c923ecddeda1e84259c18bbff7ac7` → `3cdaa1ed5bf86cde28fb3d1fe550aed1b1385d9e`
- Apply run: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36629900352 (success)
- **HTML commit (features):** `cdd4bbaae11cc5c2c00f625fd77582d75c24914e`
- Pages deploy: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36629918650 (success)
- **Current live HTML (features + urgent bugs):** `3ff72370c5172a5f8138f3e6af727ae5f0160328`

## Live verification (2026-09-29 ~16:58 ET)
`https://railroadradar.com/mytrips/` and root `index.html` contain:
- `Trip live progress cards + post-trip enrich`
- `tripTryEnrichActualTimes` / `tripLiveWarmCopy` / `TRIP_LIVE_LIST_POLL_MS`
- `trip-log-row-live` / `actualDepartTime`
- Preserved: `rrAuthUser`, nearby prompt, Alt Light tiles, full-block cards

## Re-verified after urgent bug fix (2026-09-29 ~17:07 ET)
Live HTML is now `3ff72370…` (MBTA names + `tripLogEditingId` save fix) **on top of** live-enrich `cdd4bbaa…`.

`https://railroadradar.com/` and `/mytrips/` byte-match local trees (`sha256 faf62fb6…`).
All live-progress + enrich markers still present; no regression of:
`tripLogEditingId`, `editTripLog`, `tripMbtaCanonicalStationId`, `rrAuthUser`, nearby, solid cards, Alt Light tiles.

**No new HTML publish needed** for features (1)/(2) — already live.

### Remaining gap (rules, not HTML)
Post-trip enrich may still no-op for stop-actuals-backed agencies until
`trainStopActuals` rules are published in Firebase (`TRAIN-STOP-ACTUALS-RULES.md`).
Amtrak live station ISO path does not depend on that collection.
