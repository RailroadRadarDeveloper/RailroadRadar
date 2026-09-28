# trainStopActuals — Firestore rules publish

Client code reads/writes `trainStopActuals/{agency_serviceDate_trainNumber}` to remember
past station departure times for live train popups (MBTA + Amtrak).

**Rules are in this repo’s `firestore.rules` but must be published in Firebase Console**
(or CLI) before the feature works end-to-end. Without publish, loads/saves fail silently
and past times fall back to live GTFS/Amtrak only.

## Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) → project **railroadradar-accounts**
2. Firestore Database → **Rules**
3. Add the `match /trainStopActuals/{id}` block from `firestore.rules` (before `accounts`)
4. Publish

## Rule intent (lean / safe)

- **read: true** — public transit schedule observations for map popups (no PII)
- **create/update** — schema-validated lean docs only (agency, trainNumber, serviceDate, stops≤250, updatedAt)
- **delete** — admins only

Unauthenticated write is intentional: anonymous visitors open train popups and the client
mirrors observed past times from public feeds so the next viewer sees accurate Departed times.
