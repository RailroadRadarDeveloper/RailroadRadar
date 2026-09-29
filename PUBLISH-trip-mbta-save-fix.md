# Publish: MBTA station names + trip save ReferenceError

## Root causes

1. **Save `ReferenceError: tripLogEditingId is not defined`**
   - `saveTripLog` read `tripLogEditingId` without ever declaring it (`let`/`var`/`const`).
   - First save threw before Firestore write. (User paraphrase: “TRIPID is not defined”.)
   - Also added missing `editTripLog()` (edit button called it but it did not exist).

2. **MBTA origin/dest dropdown showed stop IDs**
   - `tripEnrichMbtaStopTimes` used child/platform stop ids (e.g. `DB-2205-01`) as both `id` and `name`.
   - `MBTA_TRIP_STATIONS` / line membership use parent `place-*` ids, so labels stayed as raw ids and save could fail with “station not found”.

## Fix

- `let tripLogEditingId = null` + `editTripLog(tripId)`
- `tripMbtaCanonicalStationId` (+ child→place table) wired into `findTripStation`, `tripNormalizeStopList`, schedule enrich (`include=trip,stop`), and payload station ids

## Artifact

- `scripts/trip-mbta-save-fix.patch.gz.b64` (+ optional `.part1`)
- sha256(b64) = `60be2645e957af6fb1eaa37022b75926089e0916357c4ab5ce54460cef001fd8`
- Workflow: `.github/workflows/apply-trip-mbta-save-fix.yml`
