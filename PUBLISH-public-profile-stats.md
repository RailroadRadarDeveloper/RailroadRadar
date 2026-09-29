# Publish: Public profile button + tripLogStats correctness (2026-09-29)

## Ask
1. **Public profile** button next to **Log a trip**, with a **make public** toggle (opt-in).
2. Redesign the stats menu on My Trips.
3. Fix stats correctness: stale `userSettings.tripLogStats` vs `tripLogs`; Amtrak-as-top with only MBTA trips; rebuild on save/**delete**; fix `hiddenPublic` wrong path.
4. Follow-up: when a trip is deleted, stats MUST update; public profile visibility follows tripLogs.

## What shipped
### Public profile (MyTrips header)
- Button `#trip-log-public-profile` beside `#trip-log-primary-log` (list view on `/mytrips`).
- Popover with **Make public** toggle → `rrSavePublicProfileSettings` (writes `publicProfiles` + `userSettings.publicProfile`).
- Copy / open link when public + username set.

### Stats UI
- Cleaner card grid (Trips / Miles / Top railroad) + per-railroad chips (`.trip-log-stat-rails`).
- Top railroad prefers **trip count** (then miles) so stale miles cannot crown Amtrak.

### Stats correctness
- `ensureTripLogStats` / `rebuildTripLogStatsFromTrips` / `computeTripLogStatsFromTrips`.
- On load: compare cached `tripLogStats` to a full rebuild from flat `tripLogs` where `userId == uid`; persist if stale.
- **On save and delete: `ensureTripLogStats({ force: true })`** so stats rebuild after delete (transaction also decrements; force rebuild is source of truth).
- `hiddenPublic` write path fixed: `tripLogs/{id}` (was wrongly `tripLogs/{uid}/trips/{id}`).
- Public `/user/` already filters `!t.hiddenPublic`; deleting a trip removes the doc so it disappears from the public list.

## Markers (grep)
- `/* Public profile + stats correctness */`
- `ensureTripLogStats` / `rebuildTripLogStatsFromTrips` / `trip-log-public-profile`
- `trip-public-make-toggle` / `trip-log-stat-rails`
- delete: `ensureTripLogStats({ force: true })` inside `deleteTripLog`

## Preserved
`rrAuthUser`, nearby prompt, solid railroad cards, Alt Light trip maps, `tripLogEditingId`, MBTA canonical stations, live progress/enrich, `trainStopActuals` markers.

## Artifact
- `scripts/public-profile-stats.patch.gz.b64` (+ `.part1`–`.part23` @ 400 bytes; MCP needs small parts for fidelity)
- sha256 `56f280a2e3de0c16a72d7215b2aceac08e561402ad427ed23505f0f4dfe643b1`
- Workflow: `.github/workflows/apply-public-profile-stats.yml`

## Live verify (ET 2026-09-29 ~5:54 PM)
- Apply run: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36636234713 (success)
- HTML commit: `c3c4931cbd7977dd01cc5d9b981d77a3257ceede` — `MyTrips: public profile button + correct tripLogStats (rebuild on delete)`
- Live `/` and `/mytrips/` sha256 `3e9340777d9ae1e965a9428b7f3ca2c7d2cfe6935c368c56b6f39eaacde73753` (matches local)
- Markers present: `ensureTripLogStats`, public profile UI, fixed `hiddenPublic` path; wrong nested path absent
- `/user/` filters `hiddenPublic`
