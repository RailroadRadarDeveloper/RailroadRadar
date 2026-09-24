# Public profiles — Firestore rules publish

Lean public profiles (`/user/?u=username`) need these rules published in Firebase Console.
Firebase CLI is typically unauthenticated on agent machines — **do not block HTML publish on rules deploy**.

Project: **railroadradar-accounts**

## What changed

1. **`usernames/{name}`** — public read; owner create/update/delete (doc id must be `username.lower()`)
2. **`publicProfiles/{uid}`** — public read; owner create/update/delete of lean card only (`uid`, `username`, `displayName`, `photoURL` — **no email**)
3. **`tripLogs` read** — keep **admin** read from prior work, plus public read when `publicProfiles/{userId}` exists:

```
allow read: if isAdmin()
  || (signedIn() && resource.data.userId == request.auth.uid)
  || exists(/databases/$(database)/documents/publicProfiles/$(resource.data.userId));
```

Opt-out deletes `publicProfiles/{uid}` so trips go private even if `userSettings.publicProfile` races.

`userSettings` remains owner read/write (includes `publicProfile` + `username` fields).

## Option A — Firebase Console (recommended)

1. Open [Firebase Console](https://console.firebase.google.com/) → project **railroadradar-accounts**
2. Firestore Database → **Rules**
3. Paste the full contents of either identical local copy:
   - `/workspace/rr-publish/firestore.rules`
   - `/workspace/railroadradar-pairing/firestore.rules`
4. Publish

### Snippets (if merging by hand)

```
match /usernames/{name} {
  allow read: if true;
  allow create: if signedIn()
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.username is string
    && name == request.resource.data.username.lower();
  allow update: if signedIn()
    && resource.data.uid == request.auth.uid
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.username is string
    && name == request.resource.data.username.lower();
  allow delete: if signedIn() && resource.data.uid == request.auth.uid;
}

match /publicProfiles/{uid} {
  allow read: if true;
  allow create, update: if signedIn()
    && request.auth.uid == uid
    && request.resource.data.uid == uid
    && request.resource.data.username is string
    && request.resource.data.keys().hasAll(['uid', 'username', 'displayName', 'photoURL'])
    && (request.resource.data.displayName == null || request.resource.data.displayName is string)
    && (request.resource.data.photoURL == null || request.resource.data.photoURL is string);
  allow delete: if signedIn() && request.auth.uid == uid;
}
```

And update **tripLogs** `allow read` as above (keep create/update/delete owner-only; keep admin read).

## Option B — CLI (when authenticated)

```bash
cd /workspace/railroadradar-pairing
firebase deploy --only firestore:rules
```

## Composite index (trips page)

Public profile queries:

```
tripLogs where userId == uid orderBy startTime desc limit 50
```

If the console prompts for an index after first load, create the suggested composite index (`userId` Asc + `startTime` Desc). The page falls back to unordered `userId` query if the index is missing.

## Verify after Console publish

1. Sign in on the map → Account Settings → enable **Make my profile public**, set username, Save
2. Open `https://railroadradar.com/user/?u=YOURNAME` (and `/user/YOURNAME` via 404 redirect)
3. Confirm name, photo, and trip cards (no email)
4. Turn public off → profile page shows “isn't public”; trips no longer publicly readable
