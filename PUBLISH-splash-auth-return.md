# Publish: splash auth return / guest sticky fix (2026-09-29)

## Ask
After Google sign-in from MyTrips splash, redirect returns to guest splash instead of signed-in My Trips.

## Root cause
1. Prior fix eagerly called showMyTripsGuestHome() right after Firebase init — before getRedirectResult / onAuthStateChanged ran.
2. Those auth hooks lived only inside wireAuthUI() after map/loadSpecialIcons, so on redirect return the guest class/#mytrips-guest was painted while auth was still unresolved.
3. No rrAuthRedirect pending flag; guest could stick if the late listener never flipped UI.

Authorized domains already include railroadradar.com / www.railroadradar.com (authDomain railroadradar-accounts.firebaseapp.com). Not a domain allowlist miss.

## Fix
- Gate guest splash on rrAuthResolved + sessionStorage.rrAuthRedirect.
- Wire getRedirectResult + early onAuthStateChanged immediately after Firebase init (rrWireEarlyAuth).
- LOCAL persistence; popup success calls rrSyncMyTripsAuthGate; redirect sets pending flag + Signing in; 12s failsafe.
- Do not eagerly show guest in bootstrap; wait for auth.

## Trees
rr-publish, rr-gh-publish, railroadradar-pairing (+ mytrips/)

## Publish
- Patch: scripts/splash-auth-return.patch.gz.b64 (+ .part1-.part10)
- sha256 b64: 1a7fe7f08ca85317c54853b668b9c2a4e9d8d1eb97d6dc7c2a454ff6ce12db56
- Workflow: .github/workflows/apply-splash-auth-return.yml

## HTML commit
**fbdedbd955a349e2afb73311cd897fa9a0d7e1f1** (live verified 2026-09-29 ~18:43 ET)

## Apply / Pages
- Apply run: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36640980764 (success)
- Pages deploy: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36640994451 (success)

## Live verification
https://railroadradar.com/mytrips/ contains rrWireEarlyAuth, rrAuthResolved, rrAuthRedirect, rrSyncMyTripsAuthGate, Signing in. LIVE==local (2007484). Regression markers present: rrAuthUser, nearby, tripLogEditingId, MBTA canonical, live progress, trip map tiles.
