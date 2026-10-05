# Publish: Special-move Share geo + Firestore errors (2026-10-05)

## Ask
After 8c0ddc48 (html sha256 9799d458…), Share still did not ask for location and pins never appeared on the live map.

## Root cause
1. **/mytrips auto-started `watchPosition` / nearby `getCurrentPosition` with no user gesture.** On Safari/iOS those calls are denied (code 1) and can poison later Share taps so no permission prompt appears.
2. **Share immediately started `watchPosition` and flipped UI to “Sharing…” before any fix**, so failures looked like silent success; Firestore write errors were soft-buffered as “Connection lost”.
3. **Awaiting prior-share cleanup before `getCurrentPosition` could break the user-gesture chain** needed for the browser permission dialog.

Cross-tab live map was already Firestore-based (`specialMoveShares` → main-map `onSnapshot`); the write/prompt path never reliably produced a doc.

## Fix
- Do **not** auto-request geolocation on `/mytrips` (Share is the gesture).
- Share: sync-clear prior state → **`getCurrentPosition` only** (maximumAge 0) → arm `watchPosition` after success; require `trainTitle`; visible red status on permission deny / Firestore failure.
- Online writes always retry (no sticky offline short-circuit).
- More main-map listener retries on `/`.

## Publish
- Parts: scripts/special-move-share-geo-fix.b64.part001–016
- Chunks: scripts/special-move-share-geo-fix.patch.gz.b64.1–3
- Workflow: apply-special-move-share-geo-fix.yml
- b64 sha256: 70dee087591629e7c1a6179a9f3364be2d2663005da925617018bc8194f364e5
- html sha256: 65db048e918a8bbe873889daed00bd126b55fc46fdfeadba28fd62c966f13f3f
- Commit: a095d85d915ac3bc0e6398afc15e5b66dec98e31

## Trees
rr-publish, rr-gh-publish, railroadradar-pairing (+ mytrips)

## How to verify
1. Hard-refresh https://railroadradar.com/mytrips (confirm html sha256 65db048e…).
2. Sign in → open in-progress Special move with map title → tap **Share location**.
3. Browser must prompt for location (or show red “permission denied” status).
4. Status becomes “Sharing on the live map…”; amber ✦ on trip detail map.
5. On https://railroadradar.com (other tab/device) amber pin appears with title + Last ping.
6. If Firestore fails, red status names the error (not silent buffering).
