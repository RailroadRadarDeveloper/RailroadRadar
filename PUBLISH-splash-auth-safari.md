# Publish: Safari Google sign-in / ITP fix (2026-09-29)

## Ask
Safari: after Google sign-in, still lands as guest / not signed in. Chrome may have been OK after prior splash-auth-return fix.

## Root cause (evidence)
1. `authDomain` is `railroadradar-accounts.firebaseapp.com` while the app is on `railroadradar.com` (GitHub Pages).
2. `https://railroadradar.com/__/auth/handler` returns **404** (no same-origin auth helper / reverse proxy).
3. `rrPreferRedirectSignIn()` forced `signInWithRedirect` for all iPhone/iPad/Mobile UAs.
4. Firebase docs: browsers that block third-party storage (Safari ITP / iOS) make cross-origin `signInWithRedirect` + `getRedirectResult` return null — session never applies → guest splash.
5. Secondary: early auth cleared `rrAuthRedirect` as soon as redirect result was null, painting guest before any late hydration.

Authorized domains were already OK; this is storage partitioning, not allowlist.

## Fix
- Detect Safari/iOS (`rrIsSafariAuthRedirectBroken` / marker `rrAuthSafariItp`): prefer **popup** (Firebase Option 2); do not fall back to broken redirect when popup blocked — ask user to allow popups.
- Await `setPersistence(LOCAL)` before redirect (non-Safari mobile path) and before `getRedirectResult`.
- Do not clear pending `rrAuthRedirect` on null redirect result; extend failsafe to 20s with Safari hint.
- Keep prior splash guards / early gate.

## Trees
rr-publish, rr-gh-publish, railroadradar-pairing (+ mytrips/, RailroadRadar.html)

## Publish
- Patch: scripts/splash-auth-safari.patch.gz.b64 (+ .part1-.part7)
- sha256 b64: 2ba0a707803fe0bfea7ae6221b7b598397d704777d839538122fcf444eff2f8d
- Workflow: .github/workflows/apply-splash-auth-safari.yml

## HTML commit
**96cdb59edec8daf9e9e696f60e8e054f11e16dc7** (live verified 2026-09-29 ~19:10 ET)

## Apply / Pages
- Apply run: https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36643574001 (success)
- Pages (subsequent main deploy including fix): https://github.com/RailroadRadarDeveloper/RailroadRadar/actions/runs/36643650602 (success; head after MARC snapshot on top of fix)

## Live verification
https://railroadradar.com/mytrips/ contains rrAuthSafariItp, rrIsSafariAuthRedirectBroken, Allow popups for railroadradar.com, rrStartEarlyAuthHooks. LIVE==local (2009231). Regression markers present: rrWireEarlyAuth, rrAuthUser, nearby, tripLogEditingId, MBTA canonical, live progress, trip map tiles. Old aggressive pending clear removed.

## Manual Safari test
1. Safari (iOS or macOS): hard-refresh https://railroadradar.com/mytrips/
2. Tap Get Started — Google **popup** should appear (allow popups if prompted).
3. Complete Google sign-in → should land on signed-in My Trips (not guest splash).
4. If popup blocked: toast asks to allow popups. Redirect will not work on Safari until `/__/auth` is same-origin proxied (Firebase Option 3) and authDomain set to railroadradar.com.
