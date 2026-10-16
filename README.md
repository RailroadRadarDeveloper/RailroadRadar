# RailroadRadar

Live map of MBTA, Amtrak, Metro-North, LIRR, NJ Transit, Metra, CTrail, and MARC trains, with MyTrips trip logs and public profiles. It is a static site on GitHub Pages. Train data comes through the `railroadradar-proxy` Cloudflare Worker, and accounts and trip logs live in Firebase.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Checks

Every pull request runs three checks: every script parses and every `?v=` hash matches its file, every page loads without errors at desktop and phone width with recorded train data, and the Firestore rules allow and deny what they should. To run them yourself (Node 22, plus Java for the rules check):

```sh
npm --prefix tests ci && npm --prefix tests exec -- playwright install chromium
npm --prefix tests test
```

`npm --prefix tests run static` (or `smoke`, `rules`) runs one check. `SITE_DIR=/path/to/folder` tests another folder. `npm --prefix tests run record` saves fresh responses from the live Worker for the smoke check to replay.

After changing a file that a page loads with `?v=`, set that `?v=` to the value the static check prints.

## Deploy

GitHub Pages publishes `main` as it is whenever it changes.

`mytrips/index.html` is a symlink to `index.html`. MyTrips is the same page, switched on by the URL, so edit `index.html` only.

`firestore.rules`, `storage.rules`, and `workers/` aren't part of the website. Rules changes go live from the Firebase console. `workers/railroadradar-proxy.js` is the Worker's full source, and a change to it goes live when the whole file is pasted into the `railroadradar-proxy` Worker.
