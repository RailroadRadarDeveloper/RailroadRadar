# specialMoveShares — Firestore rules publish

Opt-in live location for **Special move** My Trips only. Ordinary trip tracking must never write live GPS to Firestore; this dedicated collection is the only live rider position path.

**Project:** `railroadradar-accounts`

## Schema (`specialMoveShares/{uid}`)
- Doc id = sharer `uid` (one active share per user)
- Fields: `uid`, `displayName?`, `tripId`, `title`, `lat`, `lon`, `heading?`, `speed?`, `startedAt` (ms), `expiresAt` (ms, ≤ started+5h), `updatedAt` (ms), `active` (bool), `recent?` (≤12 `{lat,lon,at}` trail for reconnect flush)

## Rules intent
- **read:** active shares only (map markers)
- **create/update (active):** owner only, schema-validated, reject if `expiresAt` already past, cap 5h from `startedAt`
- **update active→false** or **delete:** owner only (stop sharing)
- Banned users cannot create/update active shares

## Deploy
Firebase CLI is often unauthenticated on agent boxes. Publish rules via Console or an authenticated CLI:

```bash
cd /workspace/rr-publish   # or railroadradar-pairing
firebase deploy --only firestore:rules
```

Console: Firebase → **railroadradar-accounts** → Firestore → Rules → paste `match /specialMoveShares/{uid}` from `firestore.rules` → Publish.

Without this deploy, location writes fail with permission-denied and markers will not appear for other viewers.

## Offline / reconnect (client)
- Geolocation `watchPosition` keeps running when Firestore writes fail.
- Pings buffer locally (≤12) and flush on `online` / periodic retry; `expiresAt` is never extended or reset.
- Share auto-stops only on user Stop, 5h expiry, or trip end — not on network blips.
- Map keeps markers up to ~30 minutes and shows **Last ping X min ago**.
