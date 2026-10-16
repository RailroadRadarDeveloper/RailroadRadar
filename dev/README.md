# Local test database

Runs the site against local copies of Firebase sign-in, Firestore and Storage (the Firebase emulators), with test accounts already set up. Nothing touches the real database. Live train data still comes from the real Worker.

## Setup

Needs Node 20 or newer and Java 21 or newer. The first run installs the Firebase CLI into `dev/node_modules`.

## Run

```sh
dev/start.sh
```

Open http://localhost:8090. A red "Local test database" tag in the corner shows the page is using it. To test another checkout, such as a worktree, pass its folder:

```sh
dev/start.sh ../some-other-checkout
```

Firestore and Storage use that checkout's `firestore.rules` and `storage.rules`. Restart after editing them.

## Signing in

"Log in" opens the emulator's own account page. In the browser console, or from an agent's script, you can also sign in directly:

```js
await rrDev.signIn('alice')
rrDev.whoami()
await rrDev.signOut()
```

| User | What it's for |
| --- | --- |
| alice | Regular user with a public profile (`/user/?u=alicerider`) |
| bob | Regular user, verified reporter |
| newbie | Never signed in before: gets the Terms prompt and railroad picker |
| mod | Admin with every permission |
| owner | Bootstrap admin (railroadradar@gmail.com) |
| held | Reports wait for admin approval |
| banned | Banned account |

The accounts are in `dev/users.json`. The start also adds reports on two Amtrak trains running now, and a report over a week old on a running MBTA train, so its popup asks "Still this unit?".

## Data

```sh
node dev/seed.mjs
```

wipes everything and loads the test data again. Browse or edit the data at http://localhost:4000.

Push sign-ups and "Send to Discord" on press pages are skipped, since those go to real subscribers and the real channel. The emulator doesn't check composite indexes, so a query that needs a new index works here but fails on the live site until the index is created.
