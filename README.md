# RailroadRadar

Live map of MBTA, Amtrak, Metro-North, LIRR, NJ Transit, Metra, CTrail, and MARC trains, with MyTrips trip logs and public profiles. It is a static site on GitHub Pages. Train data comes through the `railroadradar-proxy` Cloudflare Worker, and accounts and trip logs live in Firebase.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

GitHub Pages publishes `main` as it is whenever it changes.

`mytrips/index.html` is a symlink to `index.html`. MyTrips is the same page, switched on by the URL, so edit `index.html` only.

`firestore.rules`, `storage.rules`, and `workers/` aren't part of the website. Rules changes go live from the Firebase console, and the files in `workers/` are pasted into the `railroadradar-proxy` Worker.
