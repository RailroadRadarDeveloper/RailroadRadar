# Publish: Special move location sharing (2026-10-05)

## Ask
Anyone signed in can share location up to 5 hours for Special move trips (excursion/rare/extra), with a train title on the live map. Dedicated Firestore collection — never ordinary trip GPS.

## What shipped
- Log/edit: **Special move** toggle + required **train title**
- Trip detail (in-progress, own trip): **Share my location on the live map** / **Stop sharing**
- Collection: `specialMoveShares/{uid}` (throttle ~10s / 25m)
- Live map: amber ✦ markers; popup title + first name + **Last ping …**; keep up to ~30 min through dead zones
- Offline/reconnect: geolocation keeps watching on write failures; buffers ≤12 pings; flushes on `online`/retry; **expiresAt unchanged**; never auto-stops on network blips
- Auto-stop only: user Stop, 5h expiry, or trip end

## Trees synced
rr-publish, rr-gh-publish, railroadradar-pairing (+ mytrips copies)

## Publish
- Chunks: scripts/special-move-shares.patch.gz.b64.1–3 (joined in workflow)
- Also: scripts/special-move-shares.b64.part001–032 + single patch.gz.b64
- Workflow: apply-special-move-shares.yml
- b64 sha256: fd3abe08651d93e47ccc8699e77565feac8da7c5dbb27e5fa86e2f8134a3b520
- html sha256: 0e425f63edc6006303a5ef1a51ea944eba16f5859470c0a65fb0ba05c98cf75f

## Rules
See SPECIAL-MOVE-SHARES-RULES.md — must deploy to **railroadradar-accounts**.

## How to test (phone)
1. Deploy rules first.
2. Sign in → MyTrips → Special move + title → Save in-progress trip → Share location.
3. Airplane mode briefly: status shows buffering; watch keeps running; Stop still works.
4. Back online: flushes latest (+ recent trail); marker updates; expiresAt unchanged.
5. Other device: marker stays with "Last ping X min ago" through gaps; gone after Stop/expiry/~30m stale.
