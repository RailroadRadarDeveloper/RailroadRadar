# Publish: splash / MyTrips gate login fix (2026-09-29)

## Ask
Login doesn’t work from the MyTrips splash (“Get Started”). Google-only (no email).

## Root cause
1. `#mytrips-guest` was CSS-visible on `/mytrips/` as soon as `rr-mytrips-page` was set, but `wireMyTripsGuestHome` only ran inside `wireAuthUI()` after map init + `loadSpecialIcons` — early taps on Get Started were no-ops.
2. Desktop `signInWithPopup` had no `auth/popup-blocked` → redirect fallback; double-clicks could surface `cancelled-popup-request`.
3. Guest splash lacked `hidden` by default (also leaked a block on `/`).

## Fix
- Start `#mytrips-guest` with `hidden`; show via `showMyTripsGuestHome`.
- After Firebase init, synchronously `wireMyTripsGuestHome` + `showMyTripsGuestHome` on mytrips.
- Harden `signInWithGoogle`: busy guard, popup-blocked→redirect, ignore cancelled-popup-request.
- `saveTripLog` uses `rrAuthUser()`; header login listener idempotent.

## Trees
`rr-publish`, `rr-gh-publish`, `railroadradar-pairing` (+ mytrips/)

## Publish
- Patch: `scripts/splash-auth-login.patch.gz.b64` (+ `.part1`–`.part6`)
- sha256 b64: `17ec5ce0cb55157ff9346f110a7b5ffcc1aa0a4c1d2b8459ab0142e427007f1f`
- Workflow: `.github/workflows/apply-splash-auth-login.yml`
- Apply run: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36639685268 (success)
- Pages deploy: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36639703026 (success)

## HTML commit
**dc4cfc9ce9410d1b89f652ee6cf20db30009bef6** (live verified 2026-09-29 ~18:30 ET)

## Live verification
`https://railroadradar.com/mytrips/` contains `early guest wire failed`, `rrSignInBusy`, `auth/popup-blocked`, `mytrips-guest ... hidden`, `const saveUser`. LIVE==local (2001344). Regression markers present: `rrAuthUser`, nearby, `tripLogEditingId`, MBTA canonical, live progress, Alt Light tiles, MNR stations.
