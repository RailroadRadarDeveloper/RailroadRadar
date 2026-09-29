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

## Note on rules
Client can already call `rrLoadStopActuals` (public read in local `firestore.rules`). If live enrichment silently no-ops, deploy `trainStopActuals` rules from `TRAIN-STOP-ACTUALS-RULES.md` (separate pending todo).

## Artifact
- `scripts/trip-live-enrich.patch.gz.b64` (+ `.part1` `.part2`)
- sha256 `3a5034ca0ab63c169ff12567526fb6308cd5d62e5138311de1867b0f0ee1975b`
- Workflow: `.github/workflows/apply-trip-live-enrich.yml`

## Publish
- Apply run: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36629900352 (success)
- **HTML commit:** `cdd4bbaae11cc5c2c00f625fd77582d75c24914e`
- Pages deploy: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36629918650 (success)

## Live verification (2026-09-29 ~16:58 ET)
`https://railroadradar.com/mytrips/` and root `index.html` contain `Trip live progress cards + post-trip enrich`, `tripTryEnrichActualTimes`, `tripLiveWarmCopy`, `TRIP_LIVE_LIST_POLL_MS`, `trip-log-row-live`, `actualDepartTime`. Preserved: `rrAuthUser`, nearby prompt, Alt Light tiles, full-block cards.
